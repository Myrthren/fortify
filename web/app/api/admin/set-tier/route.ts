import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { syncTierRole } from "@/lib/discord";
import type { Tier } from "@prisma/client";

const VALID_TIERS: Tier[] = ["FREE", "PRO", "ELITE", "APEX"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;
  const me = await db.user.findUnique({ where: { id: userId } });
  if (!me) return new NextResponse("Not found", { status: 404 });
  if (!isOwner(me.discordId)) return new NextResponse("Forbidden", { status: 403 });

  const { tier, targetUserId } = (await req.json()) as { tier: Tier; targetUserId?: string };
  if (!VALID_TIERS.includes(tier)) {
    return new NextResponse("Invalid tier", { status: 400 });
  }

  // Admin can change their own tier (for testing) or a specific user's tier
  const idToUpdate = targetUserId ?? userId;
  const target = targetUserId
    ? await db.user.findUnique({ where: { id: targetUserId } })
    : me;
  if (!target) return new NextResponse("Target user not found", { status: 404 });

  await db.user.update({ where: { id: idToUpdate }, data: { tier } });

  // Sync Discord role so the change is immediately reflected
  if (target.discordId) {
    await syncTierRole(target.discordId, tier).catch((e) =>
      console.error("[set-tier] syncTierRole failed:", e)
    );
  }

  return NextResponse.json({ ok: true, tier });
}
