import { NextResponse } from "next/server";
import { pollInbox } from "@/lib/outbound/engine/inbox";
import { hasInboxProvider } from "@/lib/outbound/registry";
import { tickAllCampaigns } from "@/lib/outbound/engine/tick";

export const maxDuration = 60;

/**
 * POST /api/cron/outbound-tick
 *
 * The heartbeat of the outbound employee. Every run reads replies out of the
 * sending mailbox, then advances each active campaign by one bounded step:
 * source leads, read a few sites, analyse, draft, and send at most one email
 * per campaign.
 *
 * Runs frequently and does little each time, rather than rarely and a lot. That
 * keeps every invocation inside the function timeout, spreads sends naturally
 * across the day instead of firing them in a block, and means a failed run
 * costs one cycle rather than a day's work.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Read replies BEFORE advancing anything. A reply that arrived since the
    // last run has to close its lead before the tick reaches the follow-up
    // that is due for it — otherwise the chase goes out to someone who already
    // answered, which is the single worst thing this system could do.
    let inbox = null;
    if (hasInboxProvider()) {
      try {
        inbox = await pollInbox();
      } catch (e) {
        // A mailbox that will not open must not stop the pipeline.
        console.error("[cron/outbound-tick] inbox poll failed", e);
      }
    }

    // Leave headroom under maxDuration so the response still gets written.
    const results = await tickAllCampaigns({ budgetMs: 35_000 });

    const totals = results.reduce(
      (acc, r) => ({
        discovered: acc.discovered + r.discovered,
        scraped: acc.scraped + r.scraped,
        analysed: acc.analysed + r.analysed,
        drafted: acc.drafted + r.drafted,
        sent: acc.sent + r.sent,
        errors: acc.errors + r.errors,
      }),
      { discovered: 0, scraped: 0, analysed: 0, drafted: 0, sent: 0, errors: 0 }
    );

    console.log(
      `[cron/outbound-tick] ${results.length} campaign(s):`,
      JSON.stringify(totals),
      inbox ? `inbox: ${JSON.stringify(inbox)}` : "inbox: not configured"
    );

    return NextResponse.json({
      ok: true,
      campaigns: results.length,
      totals,
      inbox,
      results,
    });
  } catch (e) {
    console.error("[cron/outbound-tick] failed", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
