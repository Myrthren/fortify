import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { BanType } from "@prisma/client";

// GET — list all active bans
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  if (!isOwner(user?.discordId ?? null)) return new NextResponse("Forbidden", { status: 403 });

  const bans = await db.banRecord.findMany({
    where: { unbannedAt: null },
    include: {
      user: { select: { id: true, username: true, name: true, discordId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bans });
}

// POST — create a ban
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const adminId = (session.user as any).id as string;
  const admin = await db.user.findUnique({ where: { id: adminId }, select: { discordId: true } });
  if (!isOwner(admin?.discordId ?? null)) return new NextResponse("Forbidden", { status: 403 });

  const { userId, type, reason, permanent, durationDays } = await req.json();
  if (!userId || !type) return NextResponse.json({ error: "userId and type required" }, { status: 400 });
  if (!["PLATFORM", "SOFTWARE"].includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const expiresAt = permanent ? null : durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : null;

  const ban = await db.banRecord.create({
    data: { userId, type: type as BanType, reason: reason ?? null, permanent: !!permanent, expiresAt },
  });

  // Update user flags
  if (type === "SOFTWARE") {
    await db.user.update({ where: { id: userId }, data: { softwareBanned: true, platformBanned: true } });
  } else {
    await db.user.update({ where: { id: userId }, data: { platformBanned: true } });
  }

  return NextResponse.json({ ban }, { status: 201 });
}
