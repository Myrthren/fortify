import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  if (!isOwner(user?.discordId ?? null)) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const ban = await db.banRecord.findUnique({ where: { id }, include: { user: { select: { id: true } } } });
  if (!ban) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.banRecord.update({ where: { id }, data: { unbannedAt: new Date() } });

  // Check if there are any remaining active bans for this user
  const remainingBans = await db.banRecord.findMany({
    where: { userId: ban.userId, unbannedAt: null, NOT: { id } },
  });

  const hasSoftware = remainingBans.some((b) => b.type === "SOFTWARE");
  const hasPlatform = remainingBans.some((b) => b.type === "PLATFORM" || b.type === "SOFTWARE");

  await db.user.update({
    where: { id: ban.userId },
    data: { softwareBanned: hasSoftware, platformBanned: hasPlatform },
  });

  return NextResponse.json({ ok: true });
}
