import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDMConditional } from "@/lib/notifications";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const subs = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      nextBillingAt: { gte: now, lte: in3days },
    },
    include: { user: true },
  });

  let sent = 0;
  for (const sub of subs) {
    if (!sub.user.discordId) continue;
    const days = Math.ceil((sub.nextBillingAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    await sendDMConditional(
      sub.user.discordId, sub.userId, "dmRenewalReminder",
      `Your Fortify ${sub.tier} plan renews in ${days} day${days === 1 ? "" : "s"}. Manage billing at https://fortify-io.com/pricing`
    );
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
