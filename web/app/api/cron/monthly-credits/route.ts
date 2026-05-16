import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import type { Tier } from "@prisma/client";

/**
 * POST /api/cron/monthly-credits
 * Run on the 1st of every month. Tops up user credits to their plan allocation.
 * Only adds credits if the user's subscription is ACTIVE.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const users = await db.user.findMany({
    where: {
      tier: { not: "FREE" },
      subscription: { status: "ACTIVE" },
    },
    select: { id: true, tier: true, credits: true },
  });

  let processed = 0;

  for (const user of users) {
    const monthly = TIER_LIMITS[user.tier as Tier].monthlyCredits;
    if (!monthly) continue;

    await db.user.update({
      where: { id: user.id },
      data: { credits: { increment: monthly } },
    });

    await db.creditTransaction.create({
      data: { userId: user.id, amount: monthly, source: `monthly_${user.tier.toLowerCase()}` },
    });

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
