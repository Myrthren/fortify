import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET — list user's connections
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const connections = await db.userConnection.findMany({
    where: {
      OR: [{ fromUserId: userId }, { toUserId: userId }],
      status: "ACCEPTED",
    },
    include: {
      from: { select: { id: true, name: true, username: true, avatarUrl: true, image: true, tier: true, profile: { select: { niche: true } } } },
      to: { select: { id: true, name: true, username: true, avatarUrl: true, image: true, tier: true, profile: { select: { niche: true } } } },
    },
  });

  const pending = await db.userConnection.findMany({
    where: { toUserId: userId, status: "PENDING" },
    include: { from: { select: { id: true, name: true, username: true, avatarUrl: true, image: true } } },
  });

  return NextResponse.json({ connections, pending });
}

// POST — send connection request
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.platformBanned || user.softwareBanned) return new NextResponse("Banned", { status: 403 });

  const { toUserId } = await req.json();
  if (!toUserId || toUserId === userId) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const target = await db.user.findUnique({ where: { id: toUserId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!target.allowConnections) return NextResponse.json({ error: "This user has disabled connection requests." }, { status: 403 });

  const existing = await db.userConnection.findFirst({
    where: {
      OR: [
        { fromUserId: userId, toUserId },
        { fromUserId: toUserId, toUserId: userId },
      ],
    },
  });

  if (existing) return NextResponse.json({ error: "Connection request already exists" }, { status: 409 });

  const conn = await db.userConnection.create({
    data: { fromUserId: userId, toUserId },
  });

  return NextResponse.json({ connection: conn }, { status: 201 });
}
