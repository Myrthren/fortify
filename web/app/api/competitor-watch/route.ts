import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { publicPageUrl } from "@/lib/public-page";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const watches = await db.competitorWatch.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      scans: {
        orderBy: { scannedAt: "desc" },
        take: 5,
      },
    },
  });

  return NextResponse.json({ watches });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (user.tier === "FREE" || user.tier === "PRO") {
    return NextResponse.json(
      { error: "Competitor Watch is an Elite+ feature. Upgrade to unlock it.", upgrade: true },
      { status: 403 }
    );
  }

  const COST = 25;
  if (user.credits < COST) {
    return NextResponse.json(
      { error: `Not enough credits. You need ${COST} credits to add a watch.` },
      { status: 402 }
    );
  }

  const body = (await req.json()) as { name?: string; links?: { url: string; label: string }[]; clientWorkspaceId?: string | null };
  if (body.clientWorkspaceId && (typeof body.clientWorkspaceId !== "string" || !await db.clientWorkspace.findFirst({ where: { id: body.clientWorkspaceId, userId } }))) return new NextResponse("Client context unavailable", { status: 404 });

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name || name.length < 1) {
    return new NextResponse("Name is required", { status: 400 });
  }

  const rawLinks = body.links ?? [];
  if (!Array.isArray(rawLinks) || rawLinks.length < 1) {
    return new NextResponse("At least one link is required", { status: 400 });
  }
  if (rawLinks.length > 3) {
    return new NextResponse("Maximum 3 links per watch", { status: 400 });
  }

  if (rawLinks.some(l => !l || typeof l.url !== "string" || (l.label !== undefined && typeof l.label !== "string"))) return new NextResponse("Invalid link data", { status: 400 });
  const links = rawLinks.map((l) => ({
    id: randomUUID(),
    url: l.url?.trim().slice(0, 500) ?? "",
    label: l.label?.trim().slice(0, 100) ?? "",
    type: "page",
  }));

  for (const link of links) {
    if (!link.url || link.url.length < 4) {
      return new NextResponse("Each link must have a valid URL", { status: 400 });
    }
    try { link.url = publicPageUrl(link.url).toString(); } catch { return NextResponse.json({ error: "Each watch link must be a public HTTP(S) website" }, { status: 400 }); }
  }

  const watch = await db.$transaction(async tx => {
    const debit = await tx.user.updateMany({ where: { id: userId, credits: { gte: COST } }, data: { credits: { decrement: COST } } });
    if (debit.count !== 1) return null;
    await tx.creditTransaction.create({ data: { userId, amount: -COST, source: "spend_competitor_watch" } });
    return tx.competitorWatch.create({
      data: {
        userId,
        clientWorkspaceId: body.clientWorkspaceId || null,
        name,
        links,
        creditsPaid: COST,
        active: true,
      },
      include: {
        scans: {
          orderBy: { scannedAt: "desc" },
          take: 5,
        },
      },
    });
  });
  if (!watch) return NextResponse.json({ error: `Not enough credits. You need ${COST} credits to add a watch.` }, { status: 402 });

  return NextResponse.json({ watch, creditsUsed: COST });
}
