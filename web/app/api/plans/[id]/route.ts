import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceUserId, workspaceError, mutationOrigin } from "@/lib/workspace-request";
import { parsePlanDocument, planCounts } from "@/lib/future-plans";
import { getPlanView, getPlanBindings, planBody, planTitle, planDescription, verifyPlanWorkflows } from "@/lib/plan-storage";
import type { Prisma } from "@prisma/client";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  const userId = await workspaceUserId(); if (!userId) return workspaceError("Sign in to see your plan.", 401);
  try { const plan = await getPlanView(userId, (await params).id); if (!plan) return workspaceError("Plan not found.", 404); return NextResponse.json({ plan, bindings: await getPlanBindings(userId) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return workspaceError("Your plan could not be loaded. Please try again.", 503); }
}
export async function PATCH(req: Request, { params }: Context) {
  const userId = await workspaceUserId(); if (!userId) return workspaceError("Sign in to save your plan.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  const { id } = await params;
  let version: number, data: Prisma.FuturePlanUpdateManyMutationInput = {};
  try {
    const body = await planBody(req); if (!Number.isSafeInteger(body.version) || (body.version as number) < 1) throw Error("Reload the plan before saving."); version = body.version as number;
    if ("title" in body) data.title = planTitle(body.title);
    if ("description" in body) data.description = planDescription(body.description);
    if ("archived" in body) { if (typeof body.archived !== "boolean") throw Error("Invalid archive preference."); data.archived = body.archived; }
    if ("document" in body) { const document = parsePlanDocument(body.document); data = { ...data, document, ...planCounts(document) }; }
    if (!Object.keys(data).length) throw Error("No changes were supplied.");
  } catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid plan request." : (error as Error).message); }
  try {
    if (data.document && !await verifyPlanWorkflows(userId, data.document as unknown as ReturnType<typeof parsePlanDocument>)) return workspaceError("An attached procedure is no longer available in your account.", 400);
    const changed = await db.futurePlan.updateMany({ where: { id, userId, version }, data: { ...data, version: { increment: 1 } } });
    if (!changed.count) { const exists = await db.futurePlan.findFirst({ where: { id, userId }, select: { id: true } }); return workspaceError(exists ? "This plan changed in another tab. Export your local copy before reloading." : "Plan not found.", exists ? 409 : 404); }
    return NextResponse.json({ plan: await getPlanView(userId, id) });
  } catch { return workspaceError("Your changes could not be saved. Your local plan is still available to export.", 503); }
}
