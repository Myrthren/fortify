import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { braveSearch } from "@/lib/brave";
import { sendDMConditional } from "@/lib/notifications";

/**
 * Coverage in the last day, used as the spike signal. Brave caps results at 20,
 * so this is a coarse "is this term unusually busy right now" proxy rather than
 * a true volume metric — good enough to flag a term worth looking at, and it
 * never fires twice in a week for the same term.
 */
const SAMPLE_COUNT = 20;
const SPIKE_MULTIPLIER = 1.5;
const MIN_BASELINE = 3; // below this, day-to-day noise dominates
const ALERT_COOLDOWN_MS = 7 * 24 * 3600_000;

/**
 * POST /api/cron/trend-alert
 * Daily. Samples recent coverage for each watched term and DMs the owner of
 * that term when it jumps well above its established baseline.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const terms = await db.watchTerm.findMany({
    where: { user: { discordId: { not: null } } },
    include: { user: { select: { id: true, discordId: true } } },
  });

  let sent = 0;
  let seeded = 0;

  for (const wt of terms) {
    try {
      const results = await braveSearch({
        query: wt.term,
        count: SAMPLE_COUNT,
        freshness: "pd",
      });
      const today = results.length;

      // First sighting: record the baseline, don't alert off a single sample.
      if (wt.baselineCount == null) {
        await db.watchTerm.update({
          where: { id: wt.id },
          data: { baselineCount: today },
        });
        seeded += 1;
        continue;
      }

      const spiked =
        wt.baselineCount >= MIN_BASELINE && today >= wt.baselineCount * SPIKE_MULTIPLIER;
      const cooled =
        !wt.lastAlertAt || Date.now() - wt.lastAlertAt.getTime() > ALERT_COOLDOWN_MS;

      if (spiked && cooled && wt.user.discordId) {
        await sendDMConditional(
          wt.user.discordId,
          wt.user.id,
          "dmTrendAlerts",
          [
            `📈 **Trend spike — "${wt.term}"**`,
            "",
            `Coverage in the last 24h is up sharply against its usual level (${today} vs ~${wt.baselineCount}).`,
            "",
            ...results.slice(0, 3).map((r) => `• ${r.title}\n${r.url}`),
            "",
            "See the full picture: https://fortify-io.com/dashboard/trends",
          ].join("\n")
        );
        await db.watchTerm.update({
          where: { id: wt.id },
          data: { lastAlertAt: new Date() },
        });
        sent += 1;
      }

      // Ease the baseline toward today's reading so it tracks gradual shifts
      // without a one-off spike permanently raising the bar.
      const nextBaseline = Math.round(wt.baselineCount * 0.7 + today * 0.3);
      await db.watchTerm.update({
        where: { id: wt.id },
        data: { baselineCount: nextBaseline },
      });
    } catch (e) {
      console.error("[cron/trend-alert] failed for term", wt.id, e);
    }
  }

  return NextResponse.json({ ok: true, checked: terms.length, seeded, sent });
}
