import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  contentActor,
  contentError,
  requireContentAccess,
} from "@/lib/content-storage";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const user = await contentActor(req, false);
    if (user instanceof Response) return user;
    requireContentAccess("test", user.tier);
    const items = await db.mediaItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, title: true, videoUrl: true, thumbnailUrl: true },
    });
    return NextResponse.json({ items });
  } catch (e) {
    return contentError(e);
  }
}
