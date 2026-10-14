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
import { loadBusinessContext } from "@/lib/business-context-store";

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

  const body = (await req.json()) as {
    prospect?: string;
    offer?: string;
    channel?: OutreachChannel;
    voiceId?: string | null;
    clientWorkspaceId?: string;
  };
  const prospect = body.prospect?.trim();
  const offer = body.offer?.trim();
  const channel = body.channel ?? "dm";
  const voiceId = body.voiceId;
  if (body.clientWorkspaceId !== undefined && (typeof body.clientWorkspaceId !== "string" || body.clientWorkspaceId.length > 100 || user.tier === "FREE")) return new NextResponse("Client contexts require paid access and a valid selection", { status: 403 });

  if (voiceId !== undefined && voiceId !== null && typeof voiceId !== "string") {
    return new NextResponse("Invalid voice selection", { status: 400 });
  }

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

  let context;
  try { context = await loadBusinessContext(userId, voiceId, body.clientWorkspaceId); }
  catch { return NextResponse.json({ error: "Client context unavailable" }, { status: 404 }); }
  const activeVoice = context.voice;

  let message: string;
  try {
    message = await generateOutreach({
      prospect,
      offer,
      channel,
      voiceSystemPrompt: activeVoice?.systemPrompt,
      businessContext: context.businessContext,
    });
  } catch (e: any) {
    console.error("[outreach] generation failed", e);
    return new NextResponse(`Generation failed: ${e.message}`, { status: 500 });
  }

  await logGeneration({
    userId,
    type: "outreach",
    input: JSON.stringify({ channel, prospect, offer }),
    output: message,
  });

  return NextResponse.json({ message, voice: activeVoice?.name ?? null, contextUsed: context.contextUsed });
}
