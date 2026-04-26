import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import type { Tier } from "@prisma/client";

const VALID_TIERS: Tier[] = ["FREE", "PRO", "ELITE", "APEX"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;
  const me = await db.user.findUnique({ where: { id: userId } });
  if (!me) return new NextResponse("Not found", { status: 404 });
  if (!isOwner(me.discordId)) return new NextResponse("Forbidden", { status: 403 });

  const { tier } = (await req.json()) as { tier: Tier };
  if (!VALID_TIERS.includes(tier)) {
    return new NextResponse("Invalid tier", { status: 400 });
  }

  await db.user.update({ where: { id: userId }, data: { tier } });
  return NextResponse.json({ ok: true, tier });
}
