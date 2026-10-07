import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { syncTierRole } from "@/lib/discord";

export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.$transaction(async (tx) => {
    const me = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { subscription: true },
    });
    const ownsAccess = me.subscription?.provider === "whop";
    await tx.user.update({
      where: { id: userId },
      data: { whopUserId: null, ...(ownsAccess ? { tier: "FREE" } : {}) },
    });
    if (ownsAccess) {
      await tx.subscription.update({
        where: { userId },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    }
    return { discordId: me.discordId, ownsAccess };
  }, { isolationLevel: "Serializable" });
  if (user.ownsAccess && user.discordId) await syncTierRole(user.discordId, "FREE");
  // This unlinks Fortify access only; recurring billing must be cancelled on Whop.
  return NextResponse.json({ ok: true });
}
