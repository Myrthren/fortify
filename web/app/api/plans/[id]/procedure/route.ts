import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceUserId, workspaceError, mutationOrigin } from "@/lib/workspace-request";
import { parsePlanDocument, planReadiness } from "@/lib/future-plans";
import { planBody } from "@/lib/plan-storage";
import { runWorkflow } from "@/lib/workflow-runner";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await workspaceUserId(); if (!userId) return workspaceError("Sign in to run procedures.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  let body: Record<string, unknown>;
  try { body = await planBody(req); if (body.approved !== true || typeof body.nodeId !== "string" || !Number.isSafeInteger(body.version) || typeof body.workflowUpdatedAt !== "string") throw Error("Review and approve this procedure before running it."); }
  catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid procedure request." : (error as Error).message); }
  const planId = (await params).id;
  const [plan, user] = await Promise.all([db.futurePlan.findFirst({ where: { id: planId, userId, archived: false } }), db.user.findUnique({ where: { id: userId }, select: { tier: true } })]);
  if (!plan) return workspaceError("Plan not found.", 404);
  if (!user || !["ELITE", "APEX"].includes(user.tier)) return workspaceError("Running attached procedures requires Elite or Apex.", 403);
  if (plan.version !== body.version) return workspaceError("The plan changed. Reload and review before running.", 409);
  const document = parsePlanDocument(plan.document), node = document.nodes.find(n => n.id === body.nodeId);
  if (!node || node.kind !== "procedure" || !node.workflowId) return workspaceError("Attach a procedure to this card first.");
  const readiness = planReadiness(document, node.id); if (!readiness.ready) return workspaceError(readiness.reason, 409);
  const workflow = await db.workflow.findFirst({ where: { id: node.workflowId, userId } });
  if (!workflow) return workspaceError("Procedure not found.", 404);
  if (workflow.updatedAt.toISOString() !== body.workflowUpdatedAt) return workspaceError("The procedure changed. Reload and review its latest actions.", 409);
  let reservation;
  try {
    reservation = await db.$transaction(async tx => {
      const locked = await tx.futurePlan.updateMany({ where: { id: planId, userId, version: plan.version, archived: false }, data: { version: { increment: 1 } } });
      if (!locked.count) throw Error("changed");
      const previous = await tx.planProcedureRun.findUnique({ where: { planId_nodeId: { planId, nodeId: node.id } } });
      if (previous) {
        if (previous.status !== "not-started") throw Error("already launched");
        const retried = await tx.planProcedureRun.updateMany({ where: { id: previous.id, status: "not-started" }, data: { workflowId: workflow.id, status: "starting", message: null, runId: null } });
        if (!retried.count) throw Error("already launched");
        return previous;
      }
      return tx.planProcedureRun.create({ data: { planId, nodeId: node.id, workflowId: workflow.id } });
    });
  } catch { return workspaceError("This step has already been launched, or the plan changed. Review the execution history before taking another action.", 409); }
  // A card is reserved before any side effects. An interrupted response never
  // causes an automatic repeat of potentially completed external actions.
  try {
    const result = await runWorkflow(workflow.id, userId, {}, workflow.updatedAt.toISOString());
    const status = result.status === "error" && !result.runId ? "not-started" : result.status;
    await db.planProcedureRun.update({ where: { id: reservation.id }, data: { status, runId: result.runId || null, message: result.status === "error" ? result.message : null } });
    return NextResponse.json({ status, runId: result.runId, workflowId: workflow.id });
  } catch {
    return workspaceError("The procedure was launched, but its final status could not be confirmed. Open workflow history before considering another run.", 503);
  }
}
