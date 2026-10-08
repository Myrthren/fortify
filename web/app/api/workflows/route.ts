import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getWorkflowStarter } from "@/lib/workflow-starters";

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

  const { name, description, starterId } = await req.json();
  const starter = typeof starterId === "string" ? getWorkflowStarter(starterId) : undefined;
  if (starterId && !starter) return NextResponse.json({ error: "Unknown workflow starter" }, { status: 400 });
  if (!starter && (typeof name !== "string" || !name.trim())) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const workflow = await db.workflow.create({
    data: {
      userId,
      name: starter?.name ?? name.trim().slice(0, 100),
      description: starter?.description ?? (typeof description === "string" ? description.trim().slice(0, 300) : null),
      ...(starter ? { nodes: { nodes: starter.nodes, connections: starter.connections } } : {}),
    },
  });

  return NextResponse.json({ workflow });
}
