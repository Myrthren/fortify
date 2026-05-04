import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDM } from "@/lib/discord";

const RESCUE_MESSAGES = [
  // Step 1 — day 3 after failure
  (name: string) =>
    `Hi ${name ?? "there"}, your Fortify payment is still failing and your access may be interrupted soon.\n\nUpdate your payment method to keep everything running: https://fortify-io.com/pricing\n\nIf you need help, reply here or contact support.`,
  // Step 2 — day 7 after failure
  (name: string) =>
    `Final notice: your Fortify subscription payment has been failing for a week. Your account will be downgraded to Free if this isn't resolved.\n\nFix your billing here: https://fortify-io.com/pricing`,
];

/**
 * POST /api/cron/payment-rescue
 * Runs daily. Sends escalating DMs for unresolved payment failures.
 * Step 0 (webhook sends immediately) → step 1 at day 3 → step 2 at day 7. Stop after step 2.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();

  const subs = await db.subscription.findMany({
    where: {
      paymentFailedAt: { not: null },
      status: { not: "ACTIVE" },
      paymentRescueStep: { lt: 2 },
    },
    include: { user: { select: { id: true, name: true, discordId: true } } },
  });

  let sent = 0;

  for (const sub of subs) {
    if (!sub.paymentFailedAt || !sub.user.discordId) continue;

    const daysSince = Math.floor(
      (now.getTime() - sub.paymentFailedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const nextStep = sub.paymentRescueStep; // 0 = should send step 1 at day 3, 1 = step 2 at day 7

    const shouldSend =
      (nextStep === 0 && daysSince >= 3) ||
      (nextStep === 1 && daysSince >= 7);

    if (!shouldSend) continue;

    try {
      const message = RESCUE_MESSAGES[nextStep](sub.user.name ?? "");
      await sendDM(sub.user.discordId, message);
      await db.subscription.update({
        where: { id: sub.id },
        data: { paymentRescueStep: nextStep + 1 },
      });
      sent++;
    } catch (e) {
      console.error(`[payment-rescue] failed for sub ${sub.id}:`, e);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
