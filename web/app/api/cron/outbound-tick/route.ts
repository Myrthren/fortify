import { NextResponse } from "next/server";
import { tickAllCampaigns } from "@/lib/outbound/engine/tick";

export const maxDuration = 60;

/**
 * POST /api/cron/outbound-tick
 *
 * The heartbeat of the outbound employee. Every run advances each active
 * campaign by one bounded step: source leads, read a few sites, analyse, draft,
 * and send at most one email per campaign.
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
    // Leave headroom under maxDuration so the response still gets written.
    const results = await tickAllCampaigns({ budgetMs: 45_000 });

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
      JSON.stringify(totals)
    );

    return NextResponse.json({ ok: true, campaigns: results.length, totals, results });
  } catch (e) {
    console.error("[cron/outbound-tick] failed", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
