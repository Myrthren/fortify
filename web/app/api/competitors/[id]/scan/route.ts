import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { scanCompetitor } from "@/lib/competitor";
import { logGeneration } from "@/lib/usage";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const me = await db.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!me) return new NextResponse("Not found", { status: 404 });

  const competitor = await db.competitor.findUnique({ where: { id } });
  if (!competitor || competitor.userId !== userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const report = await scanCompetitor({
      name: competitor.name,
      url: competitor.url,
      myProfile: me.profile
        ? {
            niche: me.profile.niche,
            skills: me.profile.skills,
            canOffer: me.profile.canOffer,
          }
        : null,
    });

    const updated = await db.competitor.update({
      where: { id },
      data: {
        lastReport: report as any,
        lastScanned: new Date(),
      },
    });

    await logGeneration({
      userId,
      type: "competitor-scan",
      input: `${competitor.name} (${competitor.url})`,
      output: JSON.stringify(report),
    });

    return NextResponse.json({ competitor: updated });
  } catch (e: any) {
    console.error("[competitor scan]", e);
    return new NextResponse(`Scan failed: ${e.message}`, { status: 500 });
  }
}
