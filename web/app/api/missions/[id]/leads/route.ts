import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceUserId, mutationOrigin, workspaceBody, workspaceError } from "@/lib/workspace-request";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { missionMilestonesForStage } from "@/lib/growth-mission";

async function requestContext(req: Request, id: string) {
  const userId = await workspaceUserId();
  if (!userId) return { error: workspaceError("Sign in to review prospects.", 401) };
  if (!mutationOrigin(req)) return { error: workspaceError("Request origin was rejected.", 403) };
  const limit = rateLimit(`mission-lead:${userId}`, 40, 60000);
  if (!limit.ok) return { error: rateLimitResponse(limit.resetMs) };
  const [user, mission] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { tier: true } }),
    db.growthMission.findFirst({ where: { id, userId }, select: { id: true, status: true } }),
  ]);
  if (!user || user.tier === "FREE") return { error: workspaceError("A paid plan is required to review mission prospects.", 403) };
  if (!mission) return { error: workspaceError("Mission not found.", 404) };
  if (mission.status !== "active") return { error: workspaceError("Reopen this mission before reviewing prospects.", 409) };
  return { userId, mission };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let context;
  try { context = await requestContext(req, id); } catch { return workspaceError("The mission could not be loaded.", 503); }
  if (context.error) return context.error;
  let leadId: string;
  try {
    const body = await workspaceBody(req);
    if (typeof body.leadId !== "string" || !body.leadId || body.leadId.length > 100) throw new Error("Choose a valid prospect.");
    leadId = body.leadId;
  } catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid request." : (error as Error).message); }
  try {
    const lead = await db.leadStatus.findFirst({ where: { id: leadId, userId: context.userId }, select: { id: true } });
    if (!lead) return workspaceError("Prospect not found in your pipeline.", 404);
    const linked = await db.growthMissionLead.upsert({
      where: { missionId_leadId: { missionId: id, leadId } },
      create: { missionId: id, leadId }, update: {},
    });
    return NextResponse.json({ linked }, { status: 201 });
  } catch { return workspaceError("The prospect could not be added to review. Try again.", 503); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let context;
  try { context = await requestContext(req, id); } catch { return workspaceError("The mission could not be loaded.", 503); }
  if (context.error) return context.error;
  let leadId: string, decision: string;
  try {
    const body = await workspaceBody(req);
    if (typeof body.leadId !== "string" || !body.leadId || body.leadId.length > 100) throw new Error("Choose a valid prospect.");
    if (body.decision !== "approved" && body.decision !== "rejected" && body.decision !== "pending") throw new Error("Choose a valid review decision.");
    leadId = body.leadId; decision = body.decision;
  } catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid request." : (error as Error).message); }
  try {
    const linked = await db.growthMissionLead.findFirst({ where: { missionId: id, leadId, lead: { userId: context.userId } }, include: { lead: { select: { status: true } } } });
    if (!linked) return workspaceError("Prospect not found in this mission.", 404);
    const now = new Date();
    const milestones = missionMilestonesForStage(linked.lead.status);
    await db.growthMissionLead.update({ where: { id: linked.id }, data: {
      decision, reviewedAt: decision === "pending" ? null : now,
      ...(decision === "approved" && !linked.repliedAt && milestones.replied ? { repliedAt: now } : {}),
      ...(decision === "approved" && !linked.bookedAt && milestones.booked ? { bookedAt: now } : {}),
      ...(decision === "approved" && !linked.wonAt && milestones.won ? { wonAt: now } : {}),
    } });
    return NextResponse.json({ decision });
  } catch { return workspaceError("The review could not be saved. Try again.", 503); }
}
