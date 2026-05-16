import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/cron/expire-bans
 * Run every hour. Lifts platform/software bans whose expiresAt has passed.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();

  // Find bans that have expired but not yet been unset
  const expired = await db.banRecord.findMany({
    where: {
      unbannedAt: null,
      permanent: false,
      expiresAt: { lte: now },
    },
    select: { id: true, userId: true },
  });

  let lifted = 0;

  for (const ban of expired) {
    await db.banRecord.update({ where: { id: ban.id }, data: { unbannedAt: now } });

    // Recompute flags based on remaining active bans
    const remaining = await db.banRecord.findMany({
      where: {
        userId: ban.userId,
        unbannedAt: null,
        NOT: { id: ban.id },
      },
    });

    const hasSoftware = remaining.some((b) => b.type === "SOFTWARE");
    const hasPlatform = remaining.some((b) => b.type === "PLATFORM" || b.type === "SOFTWARE");

    await db.user.update({
      where: { id: ban.userId },
      data: { softwareBanned: hasSoftware, platformBanned: hasPlatform },
    });

    lifted++;
  }

  return NextResponse.json({ ok: true, lifted });
}
