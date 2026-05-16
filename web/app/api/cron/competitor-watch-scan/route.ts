import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { sendDMConditional } from "@/lib/notifications";

/**
 * POST /api/cron/competitor-watch-scan
 * Runs daily. For every active CompetitorWatch, fetches each tracked URL,
 * computes an MD5 hash, and records a scan. If content changed, sends the
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

    const links = (watch.links as { id: string; url: string; label: string; type: string; lastHash?: string; lastScanAt?: string }[]);
    if (!links.length) continue;

    const newScans: { watchId: string; url: string; hasChange: boolean; summary: string }[] = [];
    const updatedLinks = [...links];
    let watchHasChange = false;

    for (let i = 0; i < updatedLinks.length; i++) {
      const link = updatedLinks[i];
      try {
        const res = await fetch(link.url, {
          signal: AbortSignal.timeout(12_000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; FortifyBot/1.0)" },
        });
        if (!res.ok) continue;

        const text = await res.text();
        const hash = createHash("md5").update(text).digest("hex");
        const hasChange = !!link.lastHash && hash !== link.lastHash;

        newScans.push({
          watchId: watch.id,
          url: link.url,
          hasChange,
          summary: hasChange ? `Content changed on ${link.label || link.url}` : "No changes detected",
        });

        updatedLinks[i] = {
          ...link,
          lastHash: hash,
          lastScanAt: new Date().toISOString(),
        };

        if (hasChange) watchHasChange = true;
      } catch {
        // Skip unreachable URLs silently
      }
    }

    if (!newScans.length) continue;

    // Write scans + update links + deduct credits atomically
    await db.$transaction([
      ...newScans.map((s) =>
        db.competitorWatchScan.create({
          data: { id: randomUUID(), watchId: s.watchId, url: s.url, hasChange: s.hasChange, summary: s.summary },
        })
      ),
      db.competitorWatch.update({
        where: { id: watch.id },
        data: { links: updatedLinks },
      }),
      db.user.update({
        where: { id: user.id },
        data: { credits: { decrement: 10 } },
      }),
    ]);

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
          `🔍 **Competitor Watch** — Changes detected for **${watch.name}**:\n${changedLinks}\n\nView: https://fortify-io.com/dashboard/competitor-tracking`
        ).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true, scanned, changesDetected });
}
