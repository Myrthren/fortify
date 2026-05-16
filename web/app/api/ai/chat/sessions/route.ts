import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET: list all sessions for the user (id, title, createdAt, updatedAt only - no messages)
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const sessions = await db.chatSession.findMany({
    where: { userId },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ sessions });
}

// POST: save a new chat session
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const { title, messages } = await req.json();
  if (!messages?.length) return NextResponse.json({ error: "No messages" }, { status: 400 });

  const sessionTitle = (title || (messages[0]?.content as string)?.slice(0, 60) || "Chat").trim();

  // Create the session
  const newSession = await db.chatSession.create({
    data: { userId, title: sessionTitle, messages },
  });

  // Enforce Pro limit: max 30 sessions
  if (user.tier === "PRO") {
    const all = await db.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (all.length > 30) {
      const toDelete = all.slice(30).map((s) => s.id);
      await db.chatSession.deleteMany({ where: { id: { in: toDelete } } });
    }
  }

  return NextResponse.json({ session: newSession });
}
