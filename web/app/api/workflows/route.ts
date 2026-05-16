import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET /api/workflows — list
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const workflows = await db.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { runs: true } } },
  });

  return NextResponse.json({ workflows });
}

// POST /api/workflows — create
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
  if (!user || (user.tier !== "ELITE" && user.tier !== "APEX")) {
    return NextResponse.json({ error: "Requires Elite or Apex plan" }, { status: 403 });
  }

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const workflow = await db.workflow.create({
    data: {
      userId,
      name: name.trim().slice(0, 100),
      description: description?.trim().slice(0, 300) ?? null,
    },
  });

  return NextResponse.json({ workflow });
}
