import { db } from "@/lib/db";
import { TOOLS } from "@/lib/tools";

// Shared by the AI Advisor (app/api/ai/advisor) and the monthly Growth Brief
// (lib/growth-brief.ts), so both read the same picture of the member.

/** Everything Fortify knows about the member, as a markdown context document. */
export async function buildAdvisorContext(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, tier: true } });

  // ── Gather all context in parallel ──────────────────────────────────────────
  const [
    activeBusiness,
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
    user?.tier === "FREE" ? Promise.resolve(null) : db.businessProfile.findFirst({ where: { userId, active: true }, select: { name: true, website: true, industry: true, stage: true, businessModel: true, offer: true, audience: true, objective: true, bottleneck: true, teamSize: true, channels: true } }),
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
      where: { userId, type: { not: "credit-job" } },
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
  lines.push(`Name: ${user?.name ?? "unknown"}`);

  if (profile?.niche) lines.push(`Niche / Industry: ${profile.niche}`);
  if (profile?.skills?.length) lines.push(`Skills: ${profile.skills.join(", ")}`);
  if (profile?.canOffer?.length) lines.push(`What they offer: ${profile.canOffer.join(", ")}`);
  if (profile?.lookingFor?.length) lines.push(`What they're looking for: ${profile.lookingFor.join(", ")}`);

  if (activeBusiness) {
    const channels = Array.isArray(activeBusiness.channels) ? (activeBusiness.channels as string[]).join(", ") : "not recorded";
    lines.push("\n## Active business context:");
    lines.push(`- **Business**: ${activeBusiness.name} (${activeBusiness.industry}; ${activeBusiness.businessModel}; ${activeBusiness.stage})`);
    if (activeBusiness.website) lines.push(`- **Website**: ${activeBusiness.website}`);
    lines.push(`- **Offer**: ${activeBusiness.offer}`);
    lines.push(`- **Audience**: ${activeBusiness.audience}`);
    lines.push(`- **Primary 90-day outcome**: ${activeBusiness.objective}`);
    lines.push(`- **Current constraint**: ${activeBusiness.bottleneck}`);
    lines.push(`- **Team**: ${activeBusiness.teamSize}; **Demand channels**: ${channels}`);
  }

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

  return lines.join("\n");
}

// Real, available tools only (from the same registry as the nav), so the
// Advisor can't recommend things that don't exist.
const EXTRA_PLACES = [
  "Content workspace: Find a content idea, Build a video or post, Review my content; saved, evidence-linked work",
  "Member Directory, Deal Board and Forums (Community menu)",
  "Fortify Discord bot: slash commands such as /hook, /outreach, /audit, /trends; alerts and reports by DM",
];
export const FORTIFY_TOOL_NAMES = Object.values(TOOLS).filter((t) => !t.soon).map((t) => t.label);
const FORTIFY_TOOL_LIST = [
  ...Object.values(TOOLS).filter((t) => !t.soon).map((t) => `- ${t.label}${t.minTier ? ` (${t.minTier[0]}${t.minTier.slice(1).toLowerCase()}+)` : ""}: ${t.desc} — ${t.href}`),
  ...EXTRA_PLACES.map((p) => `- ${p}`),
].join("\n");

const ALLOWED_FORTIFY_PHRASES = ["fortify recon", "fortify discord", "fortify ai", "fortify ai advisor", "fortify advisor", "fortify dashboard", "fortify community"];

/**
 * "Fortify Something" names in a reply that aren't real tools. Names that
 * appear in `known` (the member's own data, e.g. their workflow names) are
 * fine. Matches whole capitalised names, so "Fortify Discord server" passes
 * but "Fortify Discord Pulse" doesn't.
 */
export function inventedTools(text: string, known = ""): string[] {
  const found = text.match(/\bFortify(?:\s+[A-Z][\w&'-]*){1,4}/g) ?? [];
  const knownLower = known.toLowerCase();
  const bad = found
    .map((m) => m.replace(/\s+/g, " ").trim())
    .filter((m) => !ALLOWED_FORTIFY_PHRASES.includes(m.toLowerCase()))
    .filter((m) => !FORTIFY_TOOL_NAMES.some((name) => m.toLowerCase() === `fortify ${name.toLowerCase()}`))
    .filter((m) => !knownLower.includes(m.toLowerCase()));
  return [...new Set(bad)];
}

/** The Advisor's system prompt around a context document. */
export function advisorSystemPrompt(contextDoc: string): string {
  return `You are the Fortify AI Advisor — an elite strategic advisor for Apex-tier online business operators. You have full access to this member's business data and context.

Your role: produce comprehensive, actionable strategic analysis. Do not hold back depth or detail. This is a premium advisory session.

Rules:
- Be direct, sharp, specific. No generic advice.
- Tie recommendations to their actual data and context. Reference their specific competitors, tools, trends, and patterns by name.
- Identify what they're not doing that they should be, based on their data.
- Structure your response clearly with headers.
- End with a concrete prioritised action list (numbered, specific, actionable).
- Reference Fortify tools they can use for each recommendation, using only the tools listed below, by their exact names. If nothing listed fits, say what they'd need to do outside Fortify. Never invent a Fortify tool, feature, data feed or integration.
- Never propose discounts, free trials, giveaways, price changes or new offers unless the member's own data mentions them. If pricing looks worth testing, raise it as a question, not a plan.
- Don't assume channels, audiences or assets the member hasn't got.
- Never mention "I'm Claude" or reveal internal infrastructure.
- This member paid £199/mo — give them an answer worth that.

## Fortify tools you can recommend (nothing else exists)
${FORTIFY_TOOL_LIST}

${contextDoc}`;
}
