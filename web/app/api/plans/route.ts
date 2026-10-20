import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceUserId, workspaceError, mutationOrigin } from "@/lib/workspace-request";
import { planStarter, planCounts } from "@/lib/future-plans";
import { planBody, planTitle, planDescription } from "@/lib/plan-storage";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await workspaceUserId(); if (!userId) return workspaceError("Sign in to create plans.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  const limit = rateLimit(`create-plan:${userId}`, 10, 60000); if (!limit.ok) return rateLimitResponse(limit.resetMs);
  let title, description, document;
  try { const body = await planBody(req); title = planTitle(body.title); description = planDescription(body.description ?? ""); document = planStarter(body.template ?? "blank"); }
  catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid plan request." : (error as Error).message); }
  try { const plan = await db.futurePlan.create({ data: { userId, title, description, document, ...planCounts(document) }, select: { id: true } }); return NextResponse.json({ plan }, { status: 201 }); }
  catch { return workspaceError("Your plan could not be created. Please try again.", 503); }
}
