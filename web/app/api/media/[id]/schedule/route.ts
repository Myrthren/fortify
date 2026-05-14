import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { getNextOptimalTime } from "@/lib/virality";

// POST /api/media/[id]/schedule
// Body: { scheduledAt?: ISO string, platforms?: string[], useOptimal?: boolean }
// Apex only — queues for auto-publish

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !TIER_LIMITS[user.tier].autoPublish) {
    return NextResponse.json({ error: "Auto-publish is an Apex feature." }, { status: 403 });
  }

  const item = await db.mediaItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const useOptimal = body.useOptimal !== false;

  let scheduledAt: Date;
  if (body.scheduledAt) {
    scheduledAt = new Date(body.scheduledAt);
  } else if (useOptimal) {
    // Use the best time for the first target platform
    const primaryPlatform = item.targetPlatforms[0] ?? "tiktok";
    scheduledAt = getNextOptimalTime(primaryPlatform);
  } else {
    return NextResponse.json({ error: "Provide scheduledAt or useOptimal=true" }, { status: 400 });
  }

  await db.mediaItem.update({
    where: { id },
    data: { publishStatus: "SCHEDULED", scheduledAt },
  });

  return NextResponse.json({
    ok: true,
    scheduledAt: scheduledAt.toISOString(),
    note: useOptimal ? "Scheduled at optimal time for maximum reach." : undefined,
  });
}

// DELETE — cancel schedule
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const item = await db.mediaItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.mediaItem.update({
    where: { id },
    data: { publishStatus: "ANALYZED", scheduledAt: null },
  });

  return NextResponse.json({ ok: true });
}
