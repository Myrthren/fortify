import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { runWorkflow } from "@/lib/workflow-runner";

// POST /api/workflows/[id]/run  — trigger a manual run
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  // Verify ownership
  const workflow = await db.workflow.findFirst({ where: { id: params.id, userId } });
  if (!workflow) return new NextResponse("Not found", { status: 404 });

  // Run (manual runs don't require the workflow to be "active")
  const result = await runWorkflow(params.id, userId, {});

  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ runId: result.runId, status: result.status });
}
