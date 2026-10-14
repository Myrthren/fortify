import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runWorkflow } from "@/lib/workflow-runner";
import { latestScheduleSlot } from "@/lib/workflow-schedule";
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) return new NextResponse("Unauthorized", { status: 401 });
  const now = new Date();
  const interrupted = await db.workflowRun.updateMany({ where: { status: "running", startedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    data: { status: "interrupted", completedAt: now } });
  const workflows = await db.workflow.findMany({ where: { active: true, user: { tier: { in: ["ELITE", "APEX"] } } },
    orderBy: [{ lastUsageAt: { sort: "asc", nulls: "first" } }, { id: "asc" }], select: { id: true, userId: true, nodes: true, clientWorkspaceId: true } });
  const changes = await db.competitorWatchScan.findMany({ where: { hasChange: true, status: "changed",
    scannedAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000) } }, orderBy: { scannedAt: "asc" },
    include: { watch: { select: { name: true, userId: true, clientWorkspaceId: true } } } });
  const jobs: { workflowId: string; userId: string; payload: Parameters<typeof runWorkflow>[2] }[] = [];
  for (const wf of workflows) {
    const raw = wf.nodes as any;
    const nodes: any[] = Array.isArray(raw?.nodes) ? raw.nodes : Array.isArray(raw) ? raw : [];
    const schedule = nodes.find(node => node.type === "trigger_schedule");
    if (schedule?.config?.cron) {
      const slot = latestScheduleSlot(schedule.config.cron, now, schedule.config.timezone || "UTC");
      if (slot) jobs.push({ workflowId: wf.id, userId: wf.userId, payload: { source: "schedule", scheduledAt: slot.scheduledAt,
        idempotencyKey: `workflow:${wf.id}:schedule:${slot.wallKey}` } });
    }
    const trigger = nodes.find(node => node.type === "trigger_competitor");
    if (trigger) for (const scan of changes) {
      if (scan.watch.userId !== wf.userId || scan.watch.clientWorkspaceId !== wf.clientWorkspaceId || (trigger.config?.watchName && trigger.config.watchName !== scan.watch.name)) continue;
      const evidence = scan.evidence as any;
      if (!Array.isArray(evidence?.added) || !Array.isArray(evidence?.removed)) continue;
      jobs.push({ workflowId: wf.id, userId: wf.userId, payload: { source: "competitor", watchName: scan.watch.name,
        watchChanges: scan.summary ?? "", watchEvidence: JSON.stringify(evidence), idempotencyKey: `workflow:${wf.id}:scan:${scan.id}` } });
    }
  }
  const keys = jobs.map(job => job.payload?.idempotencyKey).filter((key): key is string => !!key);
  const existing = keys.length ? await db.workflowRun.findMany({ where: { idempotencyKey: { in: keys } }, select: { idempotencyKey: true } }) : [];
  const claimed = new Set(existing.map(run => run.idempotencyKey));
  const fresh = jobs.filter(job => !claimed.has(job.payload?.idempotencyKey ?? ""));
  const batch = fresh.slice(0, 4);
  const results = await Promise.allSettled(batch.map(job => runWorkflow(job.workflowId, job.userId, job.payload)));
  const failures = results.filter(result => result.status === "rejected" || ["error", "failed", "interrupted"].includes(result.value.status));
  return NextResponse.json({ ok: !failures.length, fired: results.length - failures.length, errors: failures.length,
    interrupted: interrupted.count, deferred: Math.max(0, fresh.length - batch.length),
    errorDetails: failures.map(result => result.status === "rejected" ? "Run failed; inspect server logs" : { runId: result.value.runId, status: result.value.status, message: result.value.message }) });
}
