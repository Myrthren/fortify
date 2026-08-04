import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { syncWhopTier } from "@/lib/whop";

export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { whopUserId: true },
  });
  if (!user?.whopUserId) return NextResponse.json({ error: "Whop not connected" }, { status: 400 });

  try {
    const { tier, membershipId, applied } = await syncWhopTier(userId, user.whopUserId);
    return NextResponse.json({ ok: true, tier, membershipId, applied });
  } catch (e: any) {
    console.error("[whop/resync]", e);
    return NextResponse.json({ error: e.message ?? "Re-sync failed" }, { status: 500 });
  }
}
