import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseMissionInput } from "@/lib/growth-mission";
import { workspaceUserId, mutationOrigin, workspaceBody, workspaceError } from "@/lib/workspace-request";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to start a mission.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  const limit = rateLimit(`mission-create:${userId}`, 6, 60000);
  if (!limit.ok) return rateLimitResponse(limit.resetMs);
  let input;
  try { input = parseMissionInput(await workspaceBody(req)); }
  catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid request." : (error as Error).message); }
  try {
    const [user, business] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { tier: true } }),
      db.businessProfile.findFirst({ where: { id: input.businessId, userId }, select: { id: true } }),
    ]);
    if (!user || user.tier === "FREE") return workspaceError("A paid plan is required to save a Growth Mission.", 403);
    if (!business) return workspaceError("Choose one of your saved businesses.", 404);
    const mission = await db.growthMission.create({ data: { userId, ...input } });
    return NextResponse.json({ mission }, { status: 201 });
  } catch { return workspaceError("Your mission could not be saved. Try again.", 503); }
}
