import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const c = await db.competitor.findUnique({ where: { id } });
  if (!c || c.userId !== userId) return new NextResponse("Not found", { status: 404 });

  await db.competitor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
