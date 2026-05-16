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

// POST — add a video to the pool (accepts multipart/form-data)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !TIER_LIMITS[user.tier].virality) {
    return NextResponse.json({ error: "Virality Engine is an Elite/Apex feature." }, { status: 403 });
  }

  const formData = await req.formData();
  const title = (formData.get("title") as string ?? "").trim();
  const description = (formData.get("description") as string ?? "").trim() || null;
  const category = (formData.get("category") as string ?? "").trim() || null;
  const targetPlatformsRaw = formData.get("targetPlatforms") as string ?? "[]";
  const targetPlatforms: string[] = JSON.parse(targetPlatformsRaw);
  const file = formData.get("file") as File | null;

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "video file required" }, { status: 400 });
  if (!targetPlatforms.length) return NextResponse.json({ error: "select at least one platform" }, { status: 400 });

  // Validate file type
  const allowed = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/mpeg"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload MP4, MOV, AVI, WebM, or MPEG." },
      { status: 400 }
    );
  }

  // TODO: In production, upload to Cloudflare R2 and store the CDN URL instead.
  // For now, store a placeholder reference with filename and size.
  const videoUrl = `[uploaded:${file.name}:${file.size}]`;

  const item = await db.mediaItem.create({
    data: { userId, title, videoUrl, description, category, targetPlatforms },
  });

  return NextResponse.json({ item }, { status: 201 });
}
