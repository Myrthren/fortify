import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mutationOrigin, workspaceError, workspaceUserId } from "@/lib/workspace-request";
import { readInstitute, validateDecisions } from "@/lib/research-institute";
import { decideInstitute, labAiEnabled } from "@/lib/research-institute-ai";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
export const maxDuration = 40;
const USER_LIMIT = 6, GLOBAL_LIMIT = 60;

export async function POST(req: Request) {
  const userId = await workspaceUserId(); if (!userId) return workspaceError("Sign in to use AI-assisted decisions.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  if (!labAiEnabled()) return workspaceError("AI decisions are not enabled here. Autonomous rules mode is available.", 503);
  const limit = rateLimit(`lab:${userId}`, 3, 60000); if (!limit.ok) return rateLimitResponse(limit.resetMs);
  let world;
  try { const raw = await req.text(); if (raw.length > 160000) throw Error("The research snapshot is too large."); world = readInstitute(JSON.parse(raw).world); if (world.status !== "active" || world.round >= 24) throw Error("This session has ended."); }
  catch { return workspaceError("Provide a valid, active research session."); }
  const input = `lab:${createHash("sha256").update(JSON.stringify(world)).digest("hex")}`;
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  let reservation: { id: string; output: string };
  try {
    reservation = await db.$transaction(async tx => {
      // A database lock makes both the global beta budget and duplicate check
      // durable across serverless instances. This reservation never charges credits.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(78431021)`;
      const existing = await tx.researchDecisionBatch.findFirst({ where: { userId, input }, select: { id: true, output: true } });
      if (existing) return existing;
      const [userCount, allCount] = await Promise.all([tx.researchDecisionBatch.count({ where: { userId, createdAt: { gte: since } } }), tx.researchDecisionBatch.count({ where: { createdAt: { gte: since } } })]);
      if (userCount >= USER_LIMIT || allCount >= GLOBAL_LIMIT) throw Error("quota");
      return tx.researchDecisionBatch.create({ data: { userId, input, output: "pending" }, select: { id: true, output: true } });
    }, { timeout: 10000 });
  } catch (e) { return workspaceError((e as Error).message === "quota" ? "The daily AI prototype limit has been reached. Continue in autonomous rules mode." : "AI decision storage is unavailable. No round was advanced.", (e as Error).message === "quota" ? 429 : 503); }
  if (reservation.output === "running") return workspaceError("An AI decision batch is already in progress for this round.", 409);
  if (reservation.output !== "pending") {
    try { const cached = JSON.parse(reservation.output); if (!cached.decisions) throw Error(); return NextResponse.json({ ...cached, decisions: validateDecisions(world, cached.decisions), cached: true }, { headers: { "Cache-Control": "no-store" } }); }
    catch { return workspaceError("This AI batch could not be completed. Use rules mode for this round; the failed call will not be repeated automatically.", 503); }
  }
  // Only one request may atomically claim a pending batch, including when
  // a retry arrives between the reservation and the first provider call.
  let claim;
  try { claim = await db.researchDecisionBatch.updateMany({ where: { id: reservation.id, userId, output: "pending" }, data: { output: "running" } }); }
  catch { return workspaceError("AI decision storage is unavailable. No provider call was started.", 503); }
  if (!claim.count) return workspaceError("An AI decision batch is already in progress for this round.", 409);
  try {
    const result = await decideInstitute(world, req.signal);
    await db.researchDecisionBatch.update({ where: { id: reservation.id }, data: { output: JSON.stringify(result) } });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await db.researchDecisionBatch.updateMany({ where: { id: reservation.id, userId }, data: { output: "failed" } }).catch(() => {});
    return workspaceError("AI decisions were unavailable. No round advanced. You can continue with autonomous rules. Decision modes are never switched automatically.", 503);
  }
}
