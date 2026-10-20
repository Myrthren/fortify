import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isWorkspaceGoal } from "@/lib/workspace-goals";
import { workspaceUserId, mutationOrigin, workspaceError, workspaceBody } from "@/lib/workspace-request";

export async function PATCH(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to save your workspace focus.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  let data: { goal?: string; dismissed?: boolean };
  try {
    const body = await workspaceBody(req);
    if (body.goal !== undefined && !isWorkspaceGoal(body.goal)) throw new Error("Choose a valid workspace focus.");
    if (body.dismissed !== undefined && typeof body.dismissed !== "boolean") throw new Error("Invalid setup preference.");
    if (body.goal === undefined && body.dismissed === undefined) throw new Error("Choose a focus or skip setup.");
    data = { ...(body.goal === undefined ? {} : { goal: body.goal as string }), ...(body.dismissed === undefined ? {} : { dismissed: body.dismissed as boolean }) };
  } catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid request." : (error as Error).message); }
  try {
    const preference = await db.workspacePreference.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return NextResponse.json({ preference });
  } catch { return workspaceError("Your focus could not be saved. Please try again.", 503); }
}
