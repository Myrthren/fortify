import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

  // ── Gather all context in parallel ──────────────────────────────────────────
  const [
    dna,
    competitors,
    watchTerms,
    recentGenerations,
    recentChatSessions,
    brandVoices,
    workflows,
    googleConn,
    shopifyConn,
    metaConn,
    profile,
  ] = await Promise.all([
    db.companyDna.findUnique({ where: { userId } }),
    db.competitor.findMany({
      where: { userId },
      select: { name: true, url: true, lastScanned: true, lastReport: true },
      orderBy: { lastScanned: "desc" },
      take: 5,
    }),
    db.watchTerm.findMany({
      where: { userId },
      select: { term: true },
      take: 20,
    }),
    db.generation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { type: true, createdAt: true },
    }),
    db.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { title: true, messages: true, createdAt: true },
    }),
    db.brandVoice.findMany({
      where: { userId },
      select: { name: true, isActive: true },
    }),
    db.workflow.findMany({
      where: { userId },
      select: { name: true, active: true },
    }),
    db.googleConnection.findUnique({ where: { userId }, select: { gaPropertyName: true, scSiteUrl: true } }),
    db.shopifyConnection.findUnique({ where: { userId }, select: { shop: true } }),
    db.metaConnection.findUnique({ where: { userId }, select: { accountId: true } }),
    db.profile.findUnique({ where: { userId }, select: { niche: true, skills: true, canOffer: true, lookingFor: true } }),
  ]);

  // ── Build context document ───────────────────────────────────────────────────
  const lines: string[] = [];

  lines.push(`# Context for this Apex member`);
  lines.push(`Name: ${user.name ?? "unknown"}`);

  if (profile?.niche) lines.push(`Niche / Industry: ${profile.niche}`);
  if (profile?.skills?.length) lines.push(`Skills: ${profile.skills.join(", ")}`);
  if (profile?.canOffer?.length) lines.push(`What they offer: ${profile.canOffer.join(", ")}`);
  if (profile?.lookingFor?.length) lines.push(`What they're looking for: ${profile.lookingFor.join(", ")}`);

  // Company DNA
  if (dna && Array.isArray(dna.entries) && (dna.entries as any[]).length > 0) {
    lines.push("\n## Company DNA (their business memory):");
    for (const entry of dna.entries as any[]) {
      lines.push(`- **${entry.label}**: ${entry.content}`);
    }
  }

  // Competitors
  if (competitors.length > 0) {
    lines.push("\n## Tracked Competitors:");
    for (const c of competitors) {
      const lastScanned = c.lastScanned ? `last scanned ${new Date(c.lastScanned).toLocaleDateString()}` : "never scanned";
      const reportSnip = c.lastReport ? String(c.lastReport).slice(0, 300) : "no report yet";
      lines.push(`- **${c.name}** (${c.url ?? "no website"}) — ${lastScanned}. Intel: ${reportSnip}`);
    }
  }

  // Trend watch terms
  if (watchTerms.length > 0) {
    lines.push("\n## Trend Radar Watch Terms:");
    lines.push(watchTerms.map((wt) => `- "${wt.term}"`).join("\n"));
  }

  // Tool usage patterns
  if (recentGenerations.length > 0) {
    const typeCounts: Record<string, number> = {};
    for (const g of recentGenerations) {
      typeCounts[g.type] = (typeCounts[g.type] ?? 0) + 1;
    }
    lines.push("\n## Recent Fortify Tool Usage (last 20 generations):");
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${type}: ${count}×`);
    }
  }

  // Brand voices
  if (brandVoices.length > 0) {
    const active = brandVoices.find((v) => v.isActive);
    lines.push(`\n## Brand Voices: ${brandVoices.map((v) => v.name).join(", ")} (active: ${active?.name ?? "none"})`);
  }

  // Workflows
  if (workflows.length > 0) {
    const activeWf = workflows.filter((w) => w.active);
    lines.push(`\n## Automation Workflows: ${workflows.length} built, ${activeWf.length} active`);
    lines.push(workflows.map((w) => `- ${w.name} (${w.active ? "active" : "inactive"})`).join("\n"));
  }

  // Connected platforms
  const platforms: string[] = [];
  if (googleConn?.gaPropertyName) platforms.push(`Google Analytics (${googleConn.gaPropertyName})`);
  if (googleConn?.scSiteUrl) platforms.push(`Search Console (${googleConn.scSiteUrl})`);
  if (shopifyConn?.shop) platforms.push(`Shopify (${shopifyConn.shop})`);
  if (metaConn?.accountId) platforms.push(`Meta Ads`);
  if (platforms.length > 0) {
    lines.push(`\n## Connected Platforms: ${platforms.join(", ")}`);
  }

  // Recent chat history context
  if (recentChatSessions.length > 0) {
    lines.push("\n## Recent AI Chat Sessions:");
    for (const s of [...recentChatSessions].reverse()) {
      const msgs = s.messages as any[];
      const firstUser = msgs.find((m) => m.role === "user")?.content?.slice(0, 300) ?? "";
      const lastAssist = [...msgs].reverse().find((m) => m.role === "assistant")?.content?.slice(0, 400) ?? "";
      if (firstUser || lastAssist) {
        lines.push(`\n**"${s.title}"** (${new Date(s.createdAt).toLocaleDateString()}):`);
        if (firstUser) lines.push(`  User: ${firstUser}`);
        if (lastAssist) lines.push(`  You: ${lastAssist}`);
      }
    }
  }

  const contextDoc = lines.join("\n");

  // ── Build system prompt ──────────────────────────────────────────────────────
  const systemPrompt = `You are the Fortify AI Advisor — an elite strategic advisor for Apex-tier online business operators. You have full access to this member's business data and context.

Your role: produce comprehensive, actionable strategic analysis. You are operating as Claude Opus — the most capable model. Do not hold back depth or detail. This is a premium advisory session.

Rules:
- Be direct, sharp, specific. No generic advice.
- Tie recommendations to their actual data and context. Reference their specific competitors, tools, trends, and patterns by name.
- Identify what they're not doing that they should be, based on their data.
- Structure your response clearly with headers.
- End with a concrete prioritised action list (numbered, specific, actionable).
- Reference Fortify tools they can use for each recommendation.
- Never mention "I'm Claude" or reveal internal infrastructure.
- This member paid £199/mo — give them an answer worth that.

${contextDoc}`;

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
