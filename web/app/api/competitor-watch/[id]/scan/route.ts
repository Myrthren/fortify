import { chargeForResult, InsufficientCredits } from "@/lib/result-credits";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createHash } from "crypto";

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

  const links = (watch.links as {
    id: string;
    url: string;
    label: string;
    type: string;
    lastHash?: string;
    lastScanAt?: string;
  }[]);

  const scansCreated: {
    id: string;
    url: string;
    hasChange: boolean;
    summary: string;
    scannedAt: string;
  }[] = [];

  const updatedLinks = [...links];
  let validPages = 0;

  for (let i = 0; i < updatedLinks.length; i++) {
    const link = updatedLinks[i];
    let hash: string | null = null;
    let hasChange = false;
    let summary = "No changes detected";

    try {
      const res = await fetch(link.url, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; FortifyBot/1.0)" },
      });
      if (!res.ok) throw new Error("Fetch failed");
      const text = await res.text();
      if (!text.trim()) throw new Error("Empty page");
      validPages++;
      hash = createHash("md5").update(text).digest("hex");
      hasChange = link.lastHash !== undefined && link.lastHash !== null
        ? hash !== link.lastHash
        : false;
      summary = hasChange ? "Content changed" : "No changes detected";
    } catch {
      summary = "Fetch failed — site unreachable or timed out";
    }

    scansCreated.push({ id: "", url: link.url, hasChange, summary, scannedAt: new Date().toISOString() });

    if (hash !== null) {
      updatedLinks[i] = {
        ...link,
        lastHash: hash,
        lastScanAt: new Date().toISOString(),
      };
    }
  }

  const creditsUsed = validPages > 0 ? COST : 0;
  try {
    if (validPages) await chargeForResult(userId, creditsUsed, "spend_competitor_watch_scan", async tx => {
      for (const result of scansCreated) {
        const saved = await tx.competitorWatchScan.create({ data: { watchId: id, url: result.url, hasChange: result.hasChange, summary: result.summary } });
        result.id = saved.id;
        result.scannedAt = saved.scannedAt.toISOString();
      }
      await tx.competitorWatch.update({ where: { id }, data: { links: updatedLinks } });
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save scan. No credits charged." },
      { status: e instanceof InsufficientCredits ? 402 : 500 });
  }

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
