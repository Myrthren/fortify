import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const item = await db.mediaItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.mediaItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
