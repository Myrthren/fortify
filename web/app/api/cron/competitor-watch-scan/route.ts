import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanWatch } from "@/lib/competitor-watch-scan";
export const maxDuration = 60;
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) return new NextResponse("Unauthorized", { status: 401 });
  const now = new Date();
  const watches = await db.competitorWatch.findMany({
    where: { active: true, user: { tier: { in: ["ELITE", "APEX"] }, credits: { gte: 10 } },
      AND: [{ OR: [{ nextScanAt: null }, { nextScanAt: { lte: now } }] }, { OR: [{ scanLeaseUntil: null }, { scanLeaseUntil: { lt: now } }] }],
    }, orderBy: [{ nextScanAt: { sort: "asc", nulls: "first" } }, { updatedAt: "asc" }], take: 2,
    select: { id: true, userId: true },
  });
  const results = await Promise.allSettled(watches.map((watch) => scanWatch(watch.id, watch.userId, true)));
  return NextResponse.json({ ok: results.every((result) => result.status === "fulfilled"), checked: results.length,
    changed: results.reduce((sum, result) => sum + (result.status === "fulfilled" ? result.value.scans.filter((scan) => scan.hasChange).length : 0), 0),
    errors: results.filter((result) => result.status === "rejected").length });
}
