import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { advisorSystemPrompt, buildAdvisorContext } from "@/lib/advisor";

/**
 * POST /api/ai/advisor
 * Apex-only. Synthesises all available user context into a strategic briefing.
 * Uses claude-opus-4-7 with up to 8,000 output tokens.
 * Saves the session to ChatSession for future reference.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  // Rate limit: 3 advisor sessions per hour (expensive)
  const rl = rateLimit(`advisor:${userId}`, 3, 60 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, tier: true, name: true, email: true, profile: true },
  });
  if (!user) return new NextResponse("Not found", { status: 404 });

  // Apex only
  if (user.tier !== "APEX") {
    return NextResponse.json({ error: "AI Advisor is an Apex-exclusive feature." }, { status: 403 });
  }

  const { challenge, sessionId } = await req.json().catch(() => ({})) as {
    challenge?: string;
    sessionId?: string; // optional: if continuing an existing session
  };

  if (!challenge || challenge.trim().length < 10) {
    return NextResponse.json({ error: "Describe your challenge (at least 10 characters)." }, { status: 400 });
  }

  const contextDoc = await buildAdvisorContext(userId);
  const systemPrompt = advisorSystemPrompt(contextDoc);

  // ── Call Opus ────────────────────────────────────────────────────────────────
  let advisorResponse = "";
  try {
    const res = await claude().messages.create({
      model: CLAUDE_MODELS.premium, // Always Opus for advisor
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: challenge.trim(),
        },
      ],
    });
    advisorResponse =
      res.content[0].type === "text" ? res.content[0].text : "Failed to generate response.";
  } catch (err: any) {
    console.error("[advisor] Claude error:", err);
    return NextResponse.json({ error: "AI unavailable. Try again shortly." }, { status: 503 });
  }

  // ── Save as a ChatSession ────────────────────────────────────────────────────
  const now = new Date();
  const title = `Strategy: ${challenge.trim().slice(0, 60)}${challenge.trim().length > 60 ? "…" : ""}`;
  const messages = [
    { role: "user", content: challenge.trim() },
    { role: "assistant", content: advisorResponse },
  ];

  let savedSessionId: string;
  if (sessionId) {
    // Append to existing session
    const existing = await db.chatSession.findFirst({ where: { id: sessionId, userId } });
    if (existing) {
      const existingMessages = existing.messages as any[];
      await db.chatSession.update({
        where: { id: sessionId },
        data: { messages: [...existingMessages, ...messages], updatedAt: now },
      });
      savedSessionId = sessionId;
    } else {
      const s = await db.chatSession.create({
        data: { userId, title, messages, createdAt: now, updatedAt: now },
      });
      savedSessionId = s.id;
    }
  } else {
    const s = await db.chatSession.create({
      data: { userId, title, messages, createdAt: now, updatedAt: now },
    });
    savedSessionId = s.id;
  }

  return NextResponse.json({
    response: advisorResponse,
    sessionId: savedSessionId,
    title,
  });
}
