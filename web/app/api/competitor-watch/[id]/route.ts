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

  const watch = await db.competitorWatch.findUnique({ where: { id } });
  if (!watch || watch.userId !== userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  await db.competitorWatch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const watch = await db.competitorWatch.findUnique({ where: { id } });
  if (!watch || watch.userId !== userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = (await req.json()) as { active?: boolean };
  if (typeof body.active !== "boolean") {
    return new NextResponse("active (boolean) is required", { status: 400 });
  }

  const updated = await db.competitorWatch.update({
    where: { id },
    data: { active: body.active },
    include: {
      scans: {
        orderBy: { scannedAt: "desc" },
        take: 5,
      },
    },
  });

  return NextResponse.json({ watch: updated });
}
