import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { runWorkflow } from "@/lib/workflow-runner";
import { randomUUID } from "node:crypto";
export const maxDuration = 60;

// POST /api/workflows/[id]/run  — trigger a manual run
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  // Verify ownership
  const workflow = await db.workflow.findFirst({ where: { id: (await params).id, userId } });
  if (!workflow) return new NextResponse("Not found", { status: 404 });

  // Run (manual runs don't require the workflow to be "active")
  const key = req.headers.get("x-idempotency-key") || randomUUID();
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(key)) return NextResponse.json({ error: "Invalid run identity" }, { status: 400 });
  const result = await runWorkflow((await params).id, userId, { source: "manual", idempotencyKey: `workflow:${workflow.id}:manual:${key}` });

  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ runId: result.runId, status: result.status });
}
