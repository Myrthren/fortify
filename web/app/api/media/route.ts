import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";

// GET — list user's media pool
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const items = await db.mediaItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

// POST — add a video to the pool
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !TIER_LIMITS[user.tier].virality) {
    return NextResponse.json({ error: "Virality Engine is an Elite/Apex feature." }, { status: 403 });
  }

  const body = await req.json();
  const title = (body.title ?? "").trim();
  const videoUrl = (body.videoUrl ?? "").trim();
  const description = (body.description ?? "").trim() || null;
  const thumbnailUrl = (body.thumbnailUrl ?? "").trim() || null;
  const category = (body.category ?? "").trim() || null;
  const targetPlatforms: string[] = body.targetPlatforms ?? [];

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!videoUrl) return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
  if (!targetPlatforms.length) return NextResponse.json({ error: "select at least one platform" }, { status: 400 });

  const item = await db.mediaItem.create({
    data: { userId, title, videoUrl, description, thumbnailUrl, category, targetPlatforms },
  });

  return NextResponse.json({ item }, { status: 201 });
}
