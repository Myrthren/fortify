import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { invalidateAnnouncements } from "@/lib/announcements";

async function guardOwner() {
  const session = await auth();
  if (!session?.user) return false;
  const me = await db.user.findUnique({
    where: { id: (session.user as any).id },
    select: { discordId: true },
  });
  return !!(me && isOwner(me.discordId));
}

// PATCH — update message or expiry
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await guardOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { message, expiresAt } = (await req.json()) as {
    message?: string;
    expiresAt?: string | null;
  };

  const announcement = await db.announcement.update({
    where: { id },
    data: {
      ...(message?.trim() ? { message: message.trim() } : {}),
      expiresAt: expiresAt === null ? null : expiresAt ? new Date(expiresAt) : undefined,
    },
  });

  invalidateAnnouncements();
  return NextResponse.json({ announcement });
}

// DELETE — remove one
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await guardOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await db.announcement.delete({ where: { id } });
  invalidateAnnouncements();
  return NextResponse.json({ ok: true });
}
