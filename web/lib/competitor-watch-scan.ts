import { db } from "@/lib/db";
import { readPublicPage } from "@/lib/public-page";
import { meaningfulPageText, comparePage } from "@/lib/competitor-diff";
import { reserveCredits, refundCredits } from "@/lib/credit-reservation";
import { sendDMConditional } from "@/lib/notifications";

type Link = { id: string; url: string; label: string; type: string; lastHash?: string; lastContent?: string; lastScanAt?: string };

export async function scanWatch(watchId: string, userId: string, daily = false) {
  const watch = await db.competitorWatch.findFirst({ where: { id: watchId, userId }, include: { user: { select: { tier: true, discordId: true } } } });
  if (!watch) throw new Error("Watch not found");
  if (!["ELITE", "APEX"].includes(watch.user.tier)) throw new Error("Competitor Watch requires Elite or Apex");
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 5 * 60_000);
  const claim = await db.competitorWatch.updateMany({
    where: { id: watchId, userId,
      ...(daily ? { active: true, AND: [{ OR: [{ nextScanAt: null }, { nextScanAt: { lte: now } }] }] } : {}),
      OR: [{ scanLeaseUntil: null }, { scanLeaseUntil: { lt: now } }],
    }, data: { scanLeaseUntil: leaseUntil },
  });
  if (!claim.count) return { scans: [], creditsUsed: 0, skipped: true };
  let reservation: Awaited<ReturnType<typeof reserveCredits>> = null;
  try {
    reservation = await reserveCredits(userId, 10, "spend_competitor_watch");
    if (!reservation) throw new Error("Not enough credits: a watch scan costs 10 credits");
    const links = Array.isArray(watch.links) ? watch.links as unknown as Link[] : [];
    if (!links.length || links.length > 3) throw new Error("Watch needs one to three valid pages");
    const results = await Promise.all(links.map(async (link) => {
      try {
        const page = await readPublicPage(link.url);
        const content = meaningfulPageText(page.html);
        if (content.length < 100) throw new Error("Too little readable text; the page may require JavaScript");
        const diff = comparePage(link.lastContent, content);
        return { link: { ...link, lastContent: content, lastHash: diff.hash, lastScanAt: now.toISOString() },
          data: { watchId, url: page.url, status: diff.status, hasChange: diff.status === "changed", summary: diff.summary,
            evidence: { ...diff.evidence, sourceUrl: page.url, checkedAt: now.toISOString() } } };
      } catch (error) {
        return { link, data: { watchId, url: link.url, status: "failed", hasChange: false,
          summary: error instanceof Error ? error.message.slice(0, 250) : "Page could not be checked",
          evidence: { sourceUrl: link.url, checkedAt: now.toISOString() } } };
      }
    }));
    const usable = results.some((result) => result.data.status !== "failed");
    const scans = await db.$transaction(async (tx) => {
      const saved = [];
      for (const result of results) saved.push(await tx.competitorWatchScan.create({ data: result.data }));
      await tx.competitorWatch.update({ where: { id: watchId }, data: {
        links: results.map((result) => result.link) as any,
        nextScanAt: new Date(now.getTime() + (usable ? 24 * 60 * 60_000 : 30 * 60_000)),
      } });
      return saved;
    });
    if (!usable) await refundCredits(reservation);
    const changed = scans.filter((scan) => scan.hasChange);
    if (changed.length) {
      const body = changed.map((scan) => scan.summary).join("\n").slice(0, 1500);
      await db.notification.create({ data: { userId, type: "competitor_change", title: `Competitor change: ${watch.name}`, body, link: "/dashboard/competitor-tracking" } }).catch(() => {});
      if (watch.user.discordId) await sendDMConditional(watch.user.discordId, userId, "dmCompetitorDone", `Competitor Watch — ${watch.name}\n${body}\nReview sources: https://fortify-io.com/dashboard/competitor-tracking`).catch(() => {});
    }
    return { scans, creditsUsed: usable ? 10 : 0, skipped: false };
  } catch (error) {
    if (reservation) await refundCredits(reservation);
    throw error;
  } finally {
    await db.competitorWatch.updateMany({ where: { id: watchId, userId, scanLeaseUntil: leaseUntil }, data: { scanLeaseUntil: null } }).catch(() => {});
  }
}
