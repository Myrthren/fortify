import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { runWorkflow } from "@/lib/workflow-runner";

/** Re-run a failed workflow from its saved definition. The original run remains
 * immutable so its node-level failure log is available for diagnosis. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const workflowId = (await params).id;
  const workflow = await db.workflow.findFirst({ where: { id: workflowId, userId } });
  if (!workflow) return new NextResponse("Not found", { status: 404 });

  const { runId } = await req.json().catch(() => ({}));
  if (typeof runId !== "string") return NextResponse.json({ error: "runId required" }, { status: 400 });
  const failedRun = await db.workflowRun.findFirst({ where: { id: runId, workflowId, status: "failed" } });
  if (!failedRun) return NextResponse.json({ error: "Only a failed run can be retried." }, { status: 400 });

  const result = await runWorkflow(workflowId, userId, {});
  if (result.status === "error") return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ runId: result.runId, status: result.status, retriedRunId: failedRun.id });
}
