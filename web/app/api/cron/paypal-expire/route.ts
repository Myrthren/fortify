import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncTierRole, sendDM } from "@/lib/discord";

/**
 * POST /api/cron/paypal-expire
 * Run every hour. A cancelled PayPal subscription keeps its tier until the
 * paid-through date stored in nextBillingAt (see the PayPal webhook); this
 * moves those accounts to Free once that date has passed.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const due = await db.subscription.findMany({
    where: {
      provider: "paypal",
      status: "CANCELLED",
      nextBillingAt: { lte: now },
      user: { tier: { not: "FREE" } },
    },
    select: { id: true, userId: true, user: { select: { discordId: true } } },
  });

  let downgraded = 0;
  const failures: string[] = [];

  for (const sub of due) {
    try {
      await db.$transaction([
        db.user.update({ where: { id: sub.userId }, data: { tier: "FREE" } }),
        db.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } }),
      ]);
      if (sub.user.discordId) {
        await syncTierRole(sub.user.discordId, "FREE");
        await sendDM(
          sub.user.discordId,
          "Your paid Fortify month has ended and your account is now on the Free tier. Resubscribe any time at https://fortify-io.com/pricing"
        );
      }
      downgraded++;
    } catch (err: any) {
      failures.push(`${sub.userId}: ${err?.message ?? String(err)}`);
    }
  }

  if (failures.length) console.error("[cron] paypal-expire failures:", failures);
  return NextResponse.json({ ok: failures.length === 0, due: due.length, downgraded, failures: failures.length });
}
