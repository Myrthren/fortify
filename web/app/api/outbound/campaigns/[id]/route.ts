import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Fields a user may change after creation. Provider keys stay editable so a
 *  campaign can be moved to a different inbox or source without rebuilding it. */
const EDITABLE_STRINGS = [
  "name",
  "targetQuery",
  "industry",
  "location",
  "offer",
  "senderName",
  "senderEmail",
  "senderTitle",
  "brandVoiceId",
  "discoveryProvider",
  "sendProvider",
] as const;

const EDITABLE_NUMBERS: Record<string, [number, number]> = {
  dailySendCap: [1, 500],
  sendWindowStartUtc: [0, 23],
  sendWindowEndUtc: [0, 23],
  maxFollowUps: [0, 6],
  minOpportunityScore: [0, 100],
  leadTarget: [1, 2000],
  minHoursBetweenSends: [0, 72],
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const existing = await db.outboundCampaign.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return new NextResponse("Not found", { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  for (const key of EDITABLE_STRINGS) {
    if (typeof body[key] === "string") {
      const t = (body[key] as string).trim();
      data[key] = t ? t.slice(0, 2000) : null;
    }
  }

  for (const [key, [min, max]] of Object.entries(EDITABLE_NUMBERS)) {
    if (body[key] !== undefined) {
      const n = Number(body[key]);
      if (Number.isFinite(n)) data[key] = Math.min(max, Math.max(min, Math.round(n)));
    }
  }

  for (const key of ["sendOnWeekends", "autoSend"]) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }

  if (Array.isArray(body.followUpDelaysDays)) {
    const delays = body.followUpDelaysDays
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 6)
      .map((n) => Math.min(90, Math.round(n)));
    if (delays.length) data.followUpDelaysDays = delays;
  }

  if (typeof body.status === "string") {
    const status = body.status.toUpperCase();
    if (["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"].includes(status)) {
      data.status = status;
      // Clearing the error on resume stops a stale failure from a week ago
      // showing as the campaign's current state.
      if (status === "ACTIVE") data.lastError = null;
    }
  }

  if (!Object.keys(data).length) {
    return new NextResponse("Nothing to update", { status: 400 });
  }

  const campaign = await db.outboundCampaign.update({ where: { id }, data });
  return NextResponse.json({ campaign });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const existing = await db.outboundCampaign.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return new NextResponse("Not found", { status: 404 });

  // Leads and emails cascade. Suppressions deliberately do not — an opt-out
  // must survive the campaign that caused it.
  await db.outboundCampaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
