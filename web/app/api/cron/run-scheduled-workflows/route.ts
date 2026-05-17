/**
 * /api/cron/run-scheduled-workflows
 * -----------------------------------
 * Called every hour by cron-job.org.
 * Finds all active workflows with a trigger_schedule node whose cron
 * expression matches the current UTC time, and fires them.
 *
 * cron-job.org setup:
 *   URL:    POST https://fortify-io.com/api/cron/run-scheduled-workflows
 *   Header: x-cron-secret: <CRON_SECRET>
 *   Interval: Every hour at :00
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runWorkflow, cronMatches } from "@/lib/workflow-runner";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();

  // Load all active workflows that have nodes saved
  const workflows = await db.workflow.findMany({
    where: { active: true },
    select: {
      id: true,
      userId: true,
      nodes: true,
      user: { select: { tier: true } },
    },
  });

  const fired: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const wf of workflows) {
    try {
      // Parse nodes
      const raw = wf.nodes as any;
      let nodes: any[] = [];
      if (raw && typeof raw === "object" && Array.isArray(raw.nodes)) {
        nodes = raw.nodes;
      } else if (Array.isArray(raw)) {
        nodes = raw;
      }

      // Find trigger_schedule node
      const triggerNode = nodes.find((n: any) => n.type === "trigger_schedule");
      if (!triggerNode) {
        skipped.push(wf.id);
        continue;
      }

      const cronExpr = triggerNode.config?.cron as string | undefined;
      if (!cronExpr) {
        skipped.push(wf.id);
        continue;
      }

      // Check if this cron expression matches right now
      if (!cronMatches(cronExpr, now)) {
        skipped.push(wf.id);
        continue;
      }

      // Fire the workflow
      const result = await runWorkflow(wf.id, wf.userId, {});
      if (result.status === "error") {
        errors.push({ id: wf.id, error: result.message ?? "unknown" });
      } else {
        fired.push(wf.id);
      }

    } catch (err: any) {
      errors.push({ id: wf.id, error: err?.message ?? String(err) });
    }
  }

  console.log(`[run-scheduled-workflows] ${now.toISOString()} fired=${fired.length} skipped=${skipped.length} errors=${errors.length}`);

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    fired: fired.length,
    skipped: skipped.length,
    errors: errors.length,
    errorDetails: errors,
  });
}
