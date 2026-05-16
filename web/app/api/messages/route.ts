import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET — get conversation with a user
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { searchParams } = new URL(req.url);
  const withUserId = searchParams.get("with");
  if (!withUserId) {
    // List conversations (unique users messaged with)
    const msgs = await db.userMessage.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      orderBy: { createdAt: "desc" },
      include: {
        from: { select: { id: true, name: true, username: true, avatarUrl: true, image: true } },
        to: { select: { id: true, name: true, username: true, avatarUrl: true, image: true } },
      },
    });
    // Dedupe by conversation partner
    const seen = new Set<string>();
    const conversations = msgs.filter((m) => {
      const partner = m.fromUserId === userId ? m.toUserId : m.fromUserId;
      if (seen.has(partner)) return false;
      seen.add(partner);
      return true;
    });
    return NextResponse.json({ conversations });
  }

  // Mark as read
  await db.userMessage.updateMany({
    where: { fromUserId: withUserId, toUserId: userId, read: false },
    data: { read: true },
  });

  const messages = await db.userMessage.findMany({
    where: {
      OR: [
        { fromUserId: userId, toUserId: withUserId },
        { fromUserId: withUserId, toUserId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return NextResponse.json({ messages });
}

// POST — send a message
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.platformBanned || user.softwareBanned) return new NextResponse("Banned", { status: 403 });

  const { toUserId, body } = await req.json();
  if (!toUserId || !body?.trim()) return NextResponse.json({ error: "toUserId and body required" }, { status: 400 });

  const target = await db.user.findUnique({ where: { id: toUserId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!target.allowMessages) return NextResponse.json({ error: "This user has disabled message requests." }, { status: 403 });

  const message = await db.userMessage.create({
    data: { fromUserId: userId, toUserId, body: body.trim() },
  });

  return NextResponse.json({ message }, { status: 201 });
}
