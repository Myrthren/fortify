import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { syncTierRole, verifyTierRole } from "@/lib/discord";
import { syncWhopTier } from "@/lib/whop";

export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { tier: true, discordId: true, whopUserId: true, subscription: { select: { provider: true } } },
  });
  if (!user) return new NextResponse("Not found", { status: 404 });

  try {
    let tier = user.tier;
    let source = "fortify";
    if (user.whopUserId && (!user.subscription || user.subscription.provider === "whop")) {
      const result = await syncWhopTier(userId, user.whopUserId);
      tier = result.effectiveTier;
      source = "whop";
    } else if (user.discordId) {
      // PayPal billing state is owned by its webhook. Repair the Discord role
      // from the stored entitlement without changing a payment record.
      await syncTierRole(user.discordId, tier);
    }

    const role = user.discordId ? await verifyTierRole(user.discordId, tier) : "not_linked";
    if (role === "mismatch") {
      return NextResponse.json({ error: "Your tier was refreshed, but the Discord role is still out of sync. Please contact support." }, { status: 502 });
    }
    const subscription = await db.subscription.findUnique({
      where: { userId },
      select: { provider: true, status: true, nextBillingAt: true },
    });
    return NextResponse.json({
      tier, source, role,
      subscription: subscription ? {
        provider: subscription.provider,
        status: subscription.status,
        nextBillingAt: subscription.nextBillingAt?.toISOString() ?? null,
      } : null,
    });
  } catch (error) {
    console.error("[billing/access/refresh]", userId, error);
    return NextResponse.json({ error: "We could not refresh your access right now. Please try again shortly." }, { status: 503 });
  }
}
