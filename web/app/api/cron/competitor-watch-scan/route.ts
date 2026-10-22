import { InsufficientCredits } from "@/lib/result-credits";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanWatch } from "@/lib/competitor-watch";
import { sendDMConditional } from "@/lib/notifications";
import { runWorkflow } from "@/lib/workflow-runner";

/** Fire any active trigger_competitor workflows for the given user */
async function fireCompetitorWorkflows(userId: string, watchName: string) {
  try {
    const workflows = await db.workflow.findMany({
      where: { userId, active: true },
      select: { id: true, nodes: true },
    });
    for (const wf of workflows) {
      const raw = wf.nodes as any;
      const nodes: any[] = Array.isArray(raw?.nodes) ? raw.nodes : Array.isArray(raw) ? raw : [];
      const triggerNode = nodes.find((n: any) => n.type === "trigger_competitor");
      if (!triggerNode) continue;
      const nameFilter = triggerNode.config?.watchName as string | undefined;
      if (nameFilter && nameFilter !== "" && nameFilter !== watchName) continue;
      runWorkflow(wf.id, userId, { watchName }).catch(() => {});
    }
  } catch { /* fire-and-forget */ }
}

/**
 * POST /api/cron/competitor-watch-scan
 * Runs daily. For every active CompetitorWatch, fetches each tracked URL,
 * compares readable wording, and records before/after excerpts. If wording changed, sends the
 * user a Discord DM.
 *
 * Triggered by Netlify scheduled function (see netlify.toml).
 * Also accepts CRON_SECRET header for manual/external triggers.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const watches = await db.competitorWatch.findMany({
    where: { active: true },
    include: { user: { select: { id: true, discordId: true, credits: true, tier: true } } },
  });

  let scanned = 0;
  let changesDetected = 0;

  for (const watch of watches) {
    const user = watch.user;
    // Skip FREE users
    if (user.tier === "FREE" || user.tier === "PRO") continue;
    // Need at least 10 credits
    if (user.credits < 10) continue;

    let result;
    try {
      result = await scanWatch(watch, `watch-daily:${watch.id}:${new Date().toISOString().slice(0, 10)}`);
    } catch (e) {
      if (!(e instanceof InsufficientCredits)) console.error("[competitor-watch] result not saved; no charge", e);
      continue;
    }
    if (result.skipped || !result.creditsUsed) continue;
    const newScans = result.scans;
    const watchHasChange = newScans.some(s => s.hasChange);

    scanned++;
    if (watchHasChange) {
      changesDetected++;
      const changedLinks = newScans.filter((s) => s.hasChange).map((s) => `• ${s.summary}`).join("\n");

      // In-app notification
      await db.notification.create({
        data: {
          userId: user.id,
          type: "competitor_change",
          title: `Competitor change: ${watch.name}`,
          body: changedLinks || "Content changed on one or more tracked pages.",
          link: "/dashboard/competitor-tracking",
        },
      }).catch(() => {});

      // Discord DM
      if (user.discordId) {
        await sendDMConditional(
          user.discordId,
          user.id,
          "dmCompetitorDone",
          `🔍 **Competitor Watch** — Changes detected for **${watch.name}**:\n${changedLinks.slice(0, 1500)}\n\nView: https://fortify-io.com/dashboard/competitor-tracking`
        ).catch(() => {});
      }

      // Fire trigger_competitor workflows
      fireCompetitorWorkflows(user.id, watch.name);
    }
  }

  return NextResponse.json({ ok: true, scanned, changesDetected });
}
