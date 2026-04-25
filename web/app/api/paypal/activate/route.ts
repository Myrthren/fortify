import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getSubscription } from "@/lib/paypal";
import { syncTierRole } from "@/lib/discord";
import { sendEmail, welcomeEmail } from "@/lib/resend";
import { PLAN_TO_TIER } from "@/lib/tiers";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const { subscriptionID } = (await req.json()) as { subscriptionID: string };
  if (!subscriptionID) return new NextResponse("Missing subscriptionID", { status: 400 });

  // Verify with PayPal
  const sub = await getSubscription(subscriptionID);
  if (sub.status !== "ACTIVE" && sub.status !== "APPROVED") {
    return new NextResponse(`Subscription not active: ${sub.status}`, { status: 400 });
  }

  const tier = PLAN_TO_TIER[sub.plan_id];
  if (!tier) return new NextResponse("Unknown plan", { status: 400 });

  // Persist
  const user = await db.user.update({
    where: { id: userId },
    data: {
      tier,
      subscription: {
        upsert: {
          create: {
            paypalSubId: subscriptionID,
            tier,
            status: "ACTIVE",
            nextBillingAt: sub.billing_info?.next_billing_time
              ? new Date(sub.billing_info.next_billing_time)
              : null,
          },
          update: {
            paypalSubId: subscriptionID,
            tier,
            status: "ACTIVE",
            cancelledAt: null,
            nextBillingAt: sub.billing_info?.next_billing_time
              ? new Date(sub.billing_info.next_billing_time)
              : null,
          },
        },
      },
    },
  });

  // Discord role
  if (user.discordId) {
    await syncTierRole(user.discordId, tier);
  }

  // Welcome email
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: `Welcome to Fortify ${tier}`,
      html: welcomeEmail(user.name ?? "there", tier),
    });
  }

  return NextResponse.json({ ok: true, tier });
}
