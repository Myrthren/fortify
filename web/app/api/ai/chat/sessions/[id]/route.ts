import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET: load a single session with messages
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const chatSession = await db.chatSession.findFirst({
    where: { id: params.id, userId },
  });
  if (!chatSession) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ session: chatSession });
}

// DELETE: remove a session
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  await db.chatSession.deleteMany({ where: { id: params.id, userId } });
  return NextResponse.json({ ok: true });
}
