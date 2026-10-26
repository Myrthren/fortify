import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BUSINESS_LIMITS, buildBusinessRecommendations, businessLimitLabel, parseBusinessSetup } from "@/lib/business-setup";
import { mutationOrigin, workspaceBody, workspaceError, workspaceUserId } from "@/lib/workspace-request";
import { tutorialScope } from "@/lib/simulation-tutorial";

const select = {
  id: true, name: true, website: true, industry: true, stage: true,
  businessModel: true, offer: true, audience: true, objective: true,
  bottleneck: true, teamSize: true, channels: true, recommendations: true,
  active: true, setupComplete: true, createdAt: true, updatedAt: true,
} as const;

export async function GET() {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to manage businesses.", 401);
  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true, businesses: { select, orderBy: [{ active: "desc" }, { updatedAt: "desc" }] } } });
  if (!user) return workspaceError("Account unavailable.", 404);
  const limit = BUSINESS_LIMITS[user.tier];
  return NextResponse.json({ businesses: user.businesses, tier: user.tier, limit: Number.isFinite(limit) ? limit : null, limitLabel: businessLimitLabel(limit) });
}

export async function POST(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to create a business.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  try {
    const body = await workspaceBody(req), input = parseBusinessSetup(body);
    const created = await db.$transaction(async tx => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { tier: true, _count: { select: { businesses: true } } } });
      if (!user) throw new Error("Account unavailable.");
      const limit = BUSINESS_LIMITS[user.tier];
      if (user._count.businesses >= limit) throw new Error(`${user.tier === "FREE" ? "Business setup requires Pro or above." : `${businessLimitLabel(limit)} business${limit === 1 ? "" : "es"} are included in your plan.`}`);
      await tx.businessProfile.updateMany({ where: { userId, active: true }, data: { active: false } });
      return tx.businessProfile.create({ data: { userId, ...input, recommendations: buildBusinessRecommendations(input), active: true }, select });
    });
    return NextResponse.json({ business: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof SyntaxError ? "Invalid request." : (error as Error).message;
    const status = /requires Pro|included in your plan/.test(message) ? 403 : /unavailable/.test(message) ? 404 : 400;
    return workspaceError(message, status);
  }
}

export async function PATCH(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to change businesses.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  try {
    const body = await workspaceBody(req), id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new Error("Choose a business.");
    const active = await db.$transaction(async tx => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { tier: true, _count: { select: { businesses: true } } } });
      if (!user) throw new Error("Account unavailable.");
      const exists = await tx.businessProfile.findFirst({ where: { id, userId }, select: { id: true } });
      if (!exists) throw new Error("Business unavailable.");
      const limit = BUSINESS_LIMITS[user.tier];
      if (limit === 0) throw new Error("Business setup requires Pro or above.");
      if (user._count.businesses > limit) throw new Error(`Your plan includes ${businessLimitLabel(limit)} business${limit === 1 ? "" : "es"}. Remove archived businesses before switching the active context.`);
      await tx.businessProfile.updateMany({ where: { userId, active: true }, data: { active: false } });
      return tx.businessProfile.update({ where: { id }, data: { active: true }, select });
    });
    return NextResponse.json({ business: active });
  } catch (error) {
    const message = error instanceof SyntaxError ? "Invalid request." : (error as Error).message;
    return workspaceError(message, /unavailable/.test(message) ? 404 : /requires Pro|plan includes/.test(message) ? 403 : 400);
  }
}

export async function PUT(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to update a business.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  try {
    const body = await workspaceBody(req), id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new Error("Choose a business.");
    const input = parseBusinessSetup(body);
    const updated = await db.$transaction(async tx => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { tier: true, _count: { select: { businesses: true } } } });
      if (!user) throw new Error("Account unavailable.");
      const limit = BUSINESS_LIMITS[user.tier];
      if (limit === 0) throw new Error("Business setup requires Pro or above.");
      const exists = await tx.businessProfile.findFirst({ where: { id, userId }, select: { id: true, active: true } });
      if (!exists) throw new Error("Business unavailable.");
      if (user._count.businesses > limit && !exists.active) throw new Error(`Your plan includes ${businessLimitLabel(limit)} business${limit === 1 ? "" : "es"}. Remove archived businesses before editing another context.`);
      return tx.businessProfile.update({ where: { id }, data: { ...input, recommendations: buildBusinessRecommendations(input) }, select });
    });
    return NextResponse.json({ business: updated });
  } catch (error) {
    const message = error instanceof SyntaxError ? "Invalid request." : (error as Error).message;
    return workspaceError(message, /unavailable/.test(message) ? 404 : /requires Pro|plan includes/.test(message) ? 403 : 400);
  }
}

export async function DELETE(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to remove businesses.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  try {
    const body = await workspaceBody(req), id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new Error("Choose a business.");
    await db.$transaction(async tx => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const target = await tx.businessProfile.findFirst({ where: { id, userId }, select: { active: true } });
      if (!target) throw new Error("Business unavailable.");
      await tx.simulationTutorialProgress.deleteMany({ where: { userId, scope: tutorialScope(id) } });
      await tx.businessProfile.delete({ where: { id } });
      if (target.active) {
        const next = await tx.businessProfile.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
        if (next) await tx.businessProfile.update({ where: { id: next.id }, data: { active: true } });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid request." : (error as Error).message); }
}
