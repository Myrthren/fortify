import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceUserId, mutationOrigin, workspaceBody, workspaceError } from "@/lib/workspace-request";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to update a mission.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  let status: string;
  try {
    const body = await workspaceBody(req);
    if (!["active", "completed", "archived"].includes(body.status as string)) throw new Error("Choose a valid mission status.");
    status = body.status as string;
  } catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid request." : (error as Error).message); }
  const { id } = await params;
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
    if (!user || user.tier === "FREE") return workspaceError("A paid plan is required to change a Growth Mission.", 403);
    const updated = await db.growthMission.updateMany({ where: { id, userId }, data: { status } });
    if (!updated.count) return workspaceError("Mission not found.", 404);
    return NextResponse.json({ mission: await db.growthMission.findFirst({ where: { id, userId } }) });
  } catch { return workspaceError("The mission could not be updated. Try again.", 503); }
}
