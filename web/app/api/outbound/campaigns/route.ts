import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listProviders } from "@/lib/outbound/registry";

/** Outbound is an Elite+ capability — it spends AI credits and sender reputation. */
const REQUIRED_TIERS = ["ELITE", "APEX"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;

  const campaigns = await db.outboundCampaign.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true, emails: true } } },
  });

  return NextResponse.json({ campaigns, providers: listProviders() });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { tier: true, email: true, name: true },
  });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (!REQUIRED_TIERS.includes(user.tier as (typeof REQUIRED_TIERS)[number])) {
    return NextResponse.json(
      { error: "The Outbound Engine is an Elite feature. Upgrade to run campaigns.", upgrade: true },
      { status: 403 }
    );
  }

  const body = (await req.json()) as Record<string, unknown>;

  const name = str(body.name, 120);
  if (!name) return new NextResponse("Name is required", { status: 400 });

  const senderEmail = str(body.senderEmail, 200);
  if (!senderEmail || !senderEmail.includes("@")) {
    return new NextResponse("A valid sender email is required", { status: 400 });
  }

  const campaign = await db.outboundCampaign.create({
    data: {
      userId,
      name,
      targetQuery: str(body.targetQuery, 300),
      industry: str(body.industry, 120),
      location: str(body.location, 120),
      offer: str(body.offer, 2000),
      senderName: str(body.senderName, 120) ?? user.name ?? "Fortify",
      senderEmail,
      senderTitle: str(body.senderTitle, 120),
      brandVoiceId: str(body.brandVoiceId, 60),
      discoveryProvider: str(body.discoveryProvider, 40) ?? "google-maps",
      sendProvider: str(body.sendProvider, 40) ?? "resend",
      dailySendCap: num(body.dailySendCap, 1, 500, 30),
      sendWindowStartUtc: num(body.sendWindowStartUtc, 0, 23, 8),
      sendWindowEndUtc: num(body.sendWindowEndUtc, 0, 23, 17),
      sendOnWeekends: Boolean(body.sendOnWeekends),
      autoSend: Boolean(body.autoSend),
      maxFollowUps: num(body.maxFollowUps, 0, 6, 3),
      minOpportunityScore: num(body.minOpportunityScore, 0, 100, 40),
      leadTarget: num(body.leadTarget, 1, 2000, 100),
      followUpDelaysDays: normaliseDelays(body.followUpDelaysDays),
      // New campaigns start paused. Nothing sends until it is switched on
      // deliberately — an outbound system that starts mailing on save is a
      // system that mails the wrong list once.
      status: "DRAFT",
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normaliseDelays(v: unknown): number[] {
  const arr = Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
  return arr.length ? arr.slice(0, 6).map((n) => Math.min(90, Math.round(n))) : [3, 7, 14];
}
