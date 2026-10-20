import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseLeadUpdate } from "@/lib/pipeline";
import { workspaceUserId, mutationOrigin, workspaceError, workspaceBody } from "@/lib/workspace-request";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to update leads.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  const { id } = await params;
  let data, version: Date;
  try {
    const body = await workspaceBody(req);
    data = parseLeadUpdate(body);
    if (typeof body.updatedAt !== "string" || !Number.isFinite(Date.parse(body.updatedAt))) throw new Error("Reload this lead before saving.");
    version = new Date(body.updatedAt);
  } catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid request." : (error as Error).message); }
  try {
    const result = await db.leadStatus.updateMany({ where: { id, userId, updatedAt: version }, data });
    if (!result.count) {
      const exists = await db.leadStatus.findFirst({ where: { id, userId }, select: { id: true } });
      return workspaceError(exists ? "This lead changed in another tab. Reload before saving your edits." : "Lead not found.", exists ? 409 : 404);
    }
    return NextResponse.json({ lead: await db.leadStatus.findFirst({ where: { id, userId } }) });
  } catch { return workspaceError("Your changes could not be saved. Please try again.", 503); }
}
