import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { checkMonthly, logGeneration } from "@/lib/usage";
import {
  generateOutreach,
  OUTREACH_CHANNELS,
  type OutreachChannel,
} from "@/lib/outreach";
import { sendDMConditional } from "@/lib/notifications";
import { flagAbuse } from "@/lib/abuse";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  // 10 outreach generations per minute per user
  const rl = rateLimit(`outreach:${userId}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const limit = TIER_LIMITS[user.tier].monthlyOutreach;
  const { ok, used } = await checkMonthly(userId, "outreach", limit);
  if (!ok) {
    void flagAbuse(userId, "outreach", `Hit outreach limit (${used}/${limit}) — tier ${user.tier}`);
    return NextResponse.json(
      {
        error:
          limit === 0
            ? "Cold Outreach Generator is a paid feature. Upgrade to Pro."
            : `You've used ${used}/${limit} outreach messages this month. Upgrade for more.`,
        upgrade: true,
      },
      { status: limit === 0 ? 403 : 429 }
    );
  }

  if (limit !== Infinity && (used + 1) >= Math.ceil(limit * 0.8) && user.discordId) {
    await sendDMConditional(
      user.discordId, userId, "dmLimitWarning",
      `Heads up: you've used ${used + 1}/${limit} outreach messages this month. Upgrade at https://fortify-io.com/pricing`
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.prospect !== "string" || typeof body.offer !== "string" || body.prospect.length > 12000 || body.offer.length > 6000 || (body.voiceId !== undefined && typeof body.voiceId !== "string")) return new NextResponse("Invalid outreach request", { status: 400 });
  const prospect = body.prospect?.trim();
  const offer = body.offer?.trim();
  const channel = body.channel ?? "dm";
  const voiceId = body.voiceId;
  const pipelineLeadId = body.pipelineLeadId;
  if (pipelineLeadId !== undefined && (typeof pipelineLeadId !== "string" || !pipelineLeadId || pipelineLeadId.length > 200)) return new NextResponse("Invalid pipeline lead", { status: 400 });
  const pipelineLead = pipelineLeadId ? await db.leadStatus.findFirst({ where: { id: pipelineLeadId, userId } }) : null;
  if (pipelineLeadId && !pipelineLead) return new NextResponse("Lead not found", { status: 404 });

  if (!prospect || prospect.length < 20) {
    return new NextResponse("Need at least 20 chars describing the prospect", {
      status: 400,
    });
  }
  if (!offer || offer.length < 10) {
    return new NextResponse("Need at least 10 chars describing your ask", {
      status: 400,
    });
  }
  if (!OUTREACH_CHANNELS.includes(channel)) {
    return new NextResponse("Invalid channel", { status: 400 });
  }

  const activeVoice = voiceId
    ? await db.brandVoice.findFirst({ where: { id: voiceId, userId }, select: { systemPrompt: true, name: true } })
    : await db.brandVoice.findFirst({ where: { userId, isActive: true }, select: { systemPrompt: true, name: true } });

  let message: string;
  try {
    message = await generateOutreach({
      prospect,
      offer,
      channel,
      voiceSystemPrompt: activeVoice?.systemPrompt,
    });
  } catch (e: any) {
    console.error("[outreach] generation failed", e);
    return new NextResponse(`Generation failed: ${e.message}`, { status: 500 });
  }

  const generation = {
    userId,
    type: "outreach",
    input: JSON.stringify({ channel, prospect, offer, ...(pipelineLeadId ? { pipelineLeadId } : {}) }),
    output: message,
  };
  await logGeneration(generation);
  if (pipelineLead) {
    const saved = await db.leadStatus.updateMany({ where: { id: pipelineLead.id, userId, updatedAt: pipelineLead.updatedAt },
      data: { draft: message, draftChannel: channel, ...(["new", "qualified", "draft-ready"].includes(pipelineLead.status) ? { status: "draft-ready" } : {}) } }).catch(() => ({ count: 0 }));
    // Keep the generated result in history even if the prospect changed meanwhile.
    if (!saved.count) return NextResponse.json({ message, voice: activeVoice?.name ?? null, pipelineSaved: false, warning: "Your draft is saved in activity history, but the prospect could not be updated. Copy this message before leaving, then review the pipeline." });
  }

  return NextResponse.json({ message, voice: activeVoice?.name ?? null, pipelineSaved: !!pipelineLead });
}
