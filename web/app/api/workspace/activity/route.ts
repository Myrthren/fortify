import { NextResponse } from "next/server";
import { getWorkspaceSnapshot } from "@/lib/workspace-activity";
import { workspaceUserId, workspaceError } from "@/lib/workspace-request";
export const dynamic = "force-dynamic";
export async function GET() {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to see your activity.", 401);
  try { return NextResponse.json(await getWorkspaceSnapshot(userId), { headers: { "Cache-Control": "no-store" } }); }
  catch { return workspaceError("Activity could not be refreshed. Your existing work is safe.", 503); }
}
