import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mutationOrigin, workspaceBody, workspaceError, workspaceUserId } from "@/lib/workspace-request";
import { tutorialState, WORKSPACE_TUTORIAL_LAST_STEP, WORKSPACE_TUTORIAL_VERSION } from "@/lib/workspace-tutorial";

const headers = { "Cache-Control": "no-store" };
export async function GET() {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to view the tutorial.", 401);
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true, workspaceTutorial: { select: { version: true, step: true, outcome: true } } } });
    if (!user) return workspaceError("Account unavailable.", 404);
    return NextResponse.json({ canReplay: true, tier: user.tier, autoStart: user.tier !== "FREE" && user.workspaceTutorial?.outcome === "pending", state: user.workspaceTutorial }, { headers });
  } catch { return workspaceError("The tutorial could not load. Try again.", 503); }
}

export async function POST(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to save tutorial progress.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  let body: Record<string, unknown>;
  try { body = await workspaceBody(req); } catch { return workspaceError("Choose valid tutorial progress."); }
  const { action, step, version } = body;
  if (version !== WORKSPACE_TUTORIAL_VERSION || typeof action !== "string" || !["advance", "skip", "complete"].includes(action) || !Number.isInteger(step) || Number(step) < 0 || Number(step) > WORKSPACE_TUTORIAL_LAST_STEP || (action === "complete" && step !== WORKSPACE_TUTORIAL_LAST_STEP)) return workspaceError("Choose valid tutorial progress.");
  try {
    const state = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const existing = await tx.workspaceTutorialProgress.findUnique({ where: { userId } });
      const next = tutorialState(existing, String(action), Number(step));
      // Manual replay never creates automatic enrollment or downgrades completion.
      await tx.workspaceTutorialProgress.upsert({ where: { userId }, create: { userId, ...next }, update: next });
      return next;
    });
    return NextResponse.json({ state }, { headers });
  } catch { return workspaceError("Tutorial progress could not be saved. Try again.", 503); }
}
