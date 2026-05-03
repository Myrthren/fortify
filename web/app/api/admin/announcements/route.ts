import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";

async function guardOwner() {
  const session = await auth();
  if (!session?.user) return null;
  const me = await db.user.findUnique({
    where: { id: (session.user as any).id },
    select: { discordId: true },
  });
  if (!me || !isOwner(me.discordId)) return null;
  return true;
}

// POST — create an announcement
export async function POST(req: Request) {
  if (!await guardOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { message, expiresAt } = (await req.json()) as {
    message?: string;
    expiresAt?: string | null;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const announcement = await db.announcement.create({
    data: {
      message: message.trim(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json({ announcement });
}

// DELETE — remove ALL announcements
export async function DELETE() {
  if (!await guardOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.announcement.deleteMany();
  return NextResponse.json({ ok: true });
}
