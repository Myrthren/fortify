import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getSubscription } from "@/lib/paypal";
import { syncTierRole, sendDM } from "@/lib/discord";
import { PLAN_TO_TIER } from "@/lib/tiers";
import { enrollWorkspaceTutorial } from "@/lib/workspace-tutorial";

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
  const user = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const previous = await tx.subscription.findUnique({ where: { userId }, select: { id: true } });
    if (!previous) await enrollWorkspaceTutorial(tx, userId);
    return tx.user.update({
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
            provider: "paypal",
            whopMembershipId: null,
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
  });

  // Discord role + welcome DM
  if (user.discordId) {
    await syncTierRole(user.discordId, tier);
    await sendDM(
      user.discordId,
      `Welcome to Fortify ${tier}, ${user.name ?? "there"}. Head to your dashboard: https://fortify-io.com/dashboard`
    );
  }

  return NextResponse.json({ ok: true, tier });
}
