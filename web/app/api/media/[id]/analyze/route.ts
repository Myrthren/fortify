import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { analyzeMediaItem } from "@/lib/virality";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const item = await db.mediaItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const report = await analyzeMediaItem({
      title: item.title,
      description: item.description,
      category: item.category,
      targetPlatforms: item.targetPlatforms,
    });

    await db.mediaItem.update({
      where: { id },
      data: {
        viralityReport: report as any,
        analyzedAt: new Date(),
        publishStatus: "ANALYZED",
      },
    });

    return NextResponse.json({ report });
  } catch (e: any) {
    console.error("[media/analyze]", e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
