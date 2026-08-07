import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Budget } from "@/lib/outbound/engine/shared";
import { tickCampaign } from "@/lib/outbound/engine/tick";

export const maxDuration = 60;

/**
 * POST /api/outbound/campaigns/[id]/run
 * Run one tick of this campaign now, ignoring the schedule. Used by the
 * "Run now" button so a user can watch the pipeline move instead of waiting
 * for the next cron.
 *
 * The send window and daily cap still apply — a manual run is a nudge, not an
 * override, and letting a button bypass sending limits is how a domain gets
 * burned.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const campaign = await db.outboundCampaign.findFirst({ where: { id, userId } });
  if (!campaign) return new NextResponse("Not found", { status: 404 });
  if (campaign.status === "ARCHIVED") {
    return NextResponse.json({ error: "Campaign is archived" }, { status: 400 });
  }

  try {
    const result = await tickCampaign(campaign, new Budget(45_000));
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[outbound] manual run failed", id, e);
    await db.outboundCampaign.update({
      where: { id },
      data: { lastError: message.slice(0, 500) },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
