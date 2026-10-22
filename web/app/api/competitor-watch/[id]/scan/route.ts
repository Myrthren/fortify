import { InsufficientCredits } from "@/lib/result-credits";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { scanWatch, WatchChanged } from "@/lib/competitor-watch";

const COST = 10;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const [user, watch] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.competitorWatch.findUnique({ where: { id } }),
  ]);

  if (!user) return new NextResponse("Not found", { status: 404 });
  if (!watch || watch.userId !== userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (user.credits < COST) {
    return NextResponse.json(
      { error: `Not enough credits. You need ${COST} credits to scan.` },
      { status: 402 }
    );
  }

  if (user.tier !== "ELITE" && user.tier !== "APEX")
    return NextResponse.json({ error: "Competitor Watch requires Elite+." }, { status: 403 });
  if (!watch.active) return NextResponse.json({ error: "Resume this watch before scanning." }, { status: 409 });

  let result;
  try {
    result = await scanWatch(watch);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save scan. No credits charged." },
      { status: e instanceof InsufficientCredits ? 402 : e instanceof WatchChanged ? 409 : 500 });
  }
  const { scans: scansCreated, creditsUsed } = result;

  // Create in-app notification for any changed pages
  const changed = scansCreated.filter((s) => s.hasChange);
  if (changed.length > 0) {
    await db.notification.create({
      data: {
        userId,
        type: "competitor_change",
        title: `Competitor change: ${watch.name}`,
        body: changed.map((s) => `• ${s.summary}`).join("\n"),
        link: "/dashboard/competitor-tracking",
      },
    }).catch(() => {});
  }

  return NextResponse.json({ scans: scansCreated, creditsUsed });
}
