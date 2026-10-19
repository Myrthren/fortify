import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PACK_TIERS } from "@/lib/lead-pack-core";

/**
 * PUT /api/lead-pack
 * Body: { category, location, offer?, enabled }
 * Saves the weekly lead pack settings (Elite and Apex). Changing the category
 * or location queues a fresh pack on the next cron tick.
 */
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
  if (!user) return new NextResponse("Not found", { status: 404 });
  if (!PACK_TIERS.includes(user.tier)) {
    return NextResponse.json({ error: "The weekly lead pack is an Elite and Apex feature.", upgrade: true }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const category = String(body.category ?? "").trim().slice(0, 80);
  const location = String(body.location ?? "").trim().slice(0, 80);
  const offer = String(body.offer ?? "").trim().slice(0, 1500) || null;
  const enabled = body.enabled !== false;
  if (!category) return NextResponse.json({ error: "Say what kind of business to find." }, { status: 400 });
  if (!location) return NextResponse.json({ error: "Say where to look." }, { status: 400 });

  const existing = await db.leadPackSetting.findUnique({ where: { userId } });
  const targetChanged = !existing || existing.category !== category || existing.location !== location;
  // A new target (or a manual retry after an error) gets a pack straight away.
  const restart = targetChanged || (enabled && !!existing?.lastError && !existing.pendingRunId);

  const setting = await db.leadPackSetting.upsert({
    where: { userId },
    create: { userId, category, location, offer, enabled },
    update: {
      category, location, offer, enabled,
      ...(restart ? { lastRunAt: null, lastError: null, pendingRunId: null, pendingSince: null } : {}),
    },
  });

  return NextResponse.json({
    setting: {
      category: setting.category,
      location: setting.location,
      offer: setting.offer,
      enabled: setting.enabled,
      pending: !!setting.pendingRunId,
      lastRunAt: setting.lastRunAt?.toISOString() ?? null,
      lastError: setting.lastError,
    },
    queued: restart && enabled,
  });
}
