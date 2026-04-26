import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// PATCH — set active / rename
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const voice = await db.brandVoice.findUnique({ where: { id } });
  if (!voice || voice.userId !== userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = (await req.json()) as { name?: string; isActive?: boolean };
  const data: { name?: string; isActive?: boolean } = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) {
    data.name = body.name.trim();
  }
  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  // If activating, deactivate other voices of same user
  if (data.isActive === true) {
    await db.brandVoice.updateMany({
      where: { userId, NOT: { id } },
      data: { isActive: false },
    });
  }

  const updated = await db.brandVoice.update({
    where: { id },
    data,
    select: { id: true, name: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ voice: updated });
}

// DELETE — remove voice
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const voice = await db.brandVoice.findUnique({ where: { id } });
  if (!voice || voice.userId !== userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  await db.brandVoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
