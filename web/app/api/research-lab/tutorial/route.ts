import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mutationOrigin, workspaceBody, workspaceError, workspaceUserId } from "@/lib/workspace-request";
import { SIMULATION_TUTORIAL_VERSION, tutorialScope } from "@/lib/simulation-tutorial";

export async function POST(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to save walkthrough progress.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  try {
    const body = await workspaceBody(req);
    if (body.version !== SIMULATION_TUTORIAL_VERSION || (body.outcome !== "completed" && body.outcome !== "skipped")) return workspaceError("Choose a valid walkthrough outcome.");
    const businessId = body.businessId === null ? null : typeof body.businessId === "string" && body.businessId.length <= 100 && body.businessId.length ? body.businessId : undefined;
    if (businessId === undefined) return workspaceError("Choose a valid business context.");
    await db.$transaction(async tx => {
      // Serialize with business switches/deletion; progress never crosses owners.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (businessId && !await tx.businessProfile.findFirst({ where: { id: businessId, userId }, select: { id: true } })) throw new Error("Business unavailable.");
      const scope = tutorialScope(businessId), version = SIMULATION_TUTORIAL_VERSION;
      const existing = await tx.simulationTutorialProgress.findUnique({ where: { userId_scope: { userId, scope } } });
      // Replaying and skipping cannot downgrade a completed tutorial.
      const outcome = existing?.version === version && existing.outcome === "completed" ? "completed" : String(body.outcome);
      await tx.simulationTutorialProgress.upsert({ where: { userId_scope: { userId, scope } }, create: { userId, scope, version, outcome }, update: { version, outcome, seenAt: new Date() } });
    });
    return NextResponse.json({ seen: true, version: SIMULATION_TUTORIAL_VERSION }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return workspaceError((cause as Error).message === "Business unavailable." ? "Business unavailable." : "Walkthrough progress could not be saved. Try again.", (cause as Error).message === "Business unavailable." ? 404 : 400);
  }
}
