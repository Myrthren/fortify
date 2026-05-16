import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET /api/workflows/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const workflow = await db.workflow.findFirst({
    where: { id: params.id, userId },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 20 } },
  });
  if (!workflow) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ workflow });
}

// PATCH /api/workflows/[id] — update name/description/active/nodes
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const existing = await db.workflow.findFirst({ where: { id: params.id, userId } });
  if (!existing) return new NextResponse("Not found", { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name        === "string") data.name        = body.name.trim().slice(0, 100);
  if (typeof body.description === "string") data.description = body.description.trim().slice(0, 300);
  if (typeof body.active      === "boolean") data.active     = body.active;
  if (Array.isArray(body.nodes)) data.nodes = body.nodes;

  const updated = await db.workflow.update({ where: { id: params.id }, data });
  return NextResponse.json({ workflow: updated });
}

// DELETE /api/workflows/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const existing = await db.workflow.findFirst({ where: { id: params.id, userId } });
  if (!existing) return new NextResponse("Not found", { status: 404 });

  await db.workflow.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
