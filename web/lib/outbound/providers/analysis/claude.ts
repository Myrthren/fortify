import { claude, CLAUDE_MODELS } from "@/lib/claude";
import {
  ANALYSIS_DIMENSIONS,
  type AnalysisInput,
  type AnalysisProvider,
  type AnalysisResult,
  type Assessment,
  type LeadAnalysis,
  type Opportunity,
  type SiteSignals,
} from "@/lib/outbound/types";

/**
 * Claude-backed business analysis.
 *
 * Two rules shape this whole file:
 *  1. The model is given the deterministic signals alongside the page text, and
 *     told those signals are authoritative. Left to the text alone it invents
 *     tooling ("I see you're using HubSpot") that isn't there.
 *  2. Every opportunity must carry `evidence` traceable to the site. That field
 *     is what the composer is allowed to reference, and what guardrails check
 *     the email against. No evidence, no claim.
 */
export const claudeAnalysis: AnalysisProvider = {
  key: "claude",
  label: "Claude",

  isAvailable() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  async analyse(input: AnalysisInput): Promise<AnalysisResult> {
    const res = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return normalise(parseJson(text), input);
  },
};

const SYSTEM = `You are a business analyst for Fortify, an AI automation and business-systems agency. You look at a company's website and work out, honestly, where automation or AI would save them time or money.

You are analysing for a cold outreach email, so accuracy matters more than enthusiasm. A weak, invented observation destroys credibility; saying "this business looks well set up" is a perfectly good answer.

Hard rules:
- The DETECTED SIGNALS block is machine-verified fact. Trust it over your reading of the page text. If a signal says no booking widget was found, do not claim they have one.
- Absence of a signal means "not detected", which for a plain-text scrape is strong but not absolute evidence. Phrase opportunities accordingly.
- Every opportunity's "evidence" must point at something concretely present in or absent from the supplied material. Never invent staff names, client counts, revenue, tools, or history.
- Do not treat normal small-business choices as failures. Not having a chatbot is not a crisis.
- If the site is a parked domain, a directory listing, a competing agency, or has too little content to judge, set "disqualify".

Fortify services you may map opportunities to: Lead Extractor (finding and enriching leads), Outreach Engine (personalised cold email at scale), Workflows (multi-step automations across email/Discord/Slack/Notion/Shopify), Brand Voice (consistent AI writing), Competitor Tracking, Trend Radar, Funnel Audit, Analytics, AI Chat Assistant, Company DNA.

Return ONLY a JSON object, no prose, no markdown fence:
{
  "analysis": {
    "websiteQuality":     {"rating": 1-5, "note": "one sentence"},
    "leadCapture":        {"rating": 1-5, "note": "..."},
    "bookingSystem":      {"rating": 1-5, "note": "..."},
    "contactForms":       {"rating": 1-5, "note": "..."},
    "crm":                {"rating": 1-5, "note": "..."},
    "chatbot":            {"rating": 1-5, "note": "..."},
    "automation":         {"rating": 1-5, "note": "..."},
    "manualWorkflows":    {"rating": 1-5, "note": "..."},
    "marketing":          {"rating": 1-5, "note": "..."},
    "seo":                {"rating": 1-5, "note": "..."},
    "customerExperience": {"rating": 1-5, "note": "..."}
  },
  "opportunities": [
    {"title": "short label", "evidence": "what on the site shows this", "impact": "high|medium|low", "fortifyService": "one of the services above", "score": 0-100}
  ],
  "summary": "2-4 sentences on why Fortify could help this specific business",
  "suggestedService": "the single best-fit Fortify service",
  "opportunityScore": 0-100,
  "contactName": "owner/founder name if the site states one, else null",
  "industry": "specific industry, else null",
  "disqualify": null
}

rating 1 = badly broken, 3 = adequate, 5 = strong.
opportunityScore is how worthwhile this lead is to contact: 0 = leave alone, 100 = obvious high-value fit.
Return at most 4 opportunities, best first. Zero is a valid answer.
To disqualify, set "disqualify": {"reason": "..."} and keep the other fields as best you can.`;

function buildPrompt(input: AnalysisInput): string {
  const parts: string[] = [
    `COMPANY: ${input.company}`,
    `WEBSITE: ${input.website ?? "unknown"}`,
  ];
  if (input.industry) parts.push(`INDUSTRY (claimed): ${input.industry}`);
  if (input.location) parts.push(`LOCATION: ${input.location}`);

  parts.push(
    "",
    "WHAT WE SELL (judge opportunities against this):",
    input.offer
  );

  if (input.site) {
    parts.push("", "DETECTED SIGNALS (machine-verified, authoritative):", formatSignals(input.site.signals));
    parts.push(
      "",
      `PAGES FETCHED: ${input.site.pages.map((p) => p.url).join(", ")}`,
      "",
      "WEBSITE TEXT:",
      input.site.text || "(no readable text extracted)"
    );
  } else {
    parts.push(
      "",
      "NO WEBSITE COULD BE FETCHED. Judge only from the company name and industry, keep every rating conservative, and disqualify unless there is a clear generic case."
    );
  }

  parts.push("", "Analyse now. JSON only.");
  return parts.join("\n");
}

function formatSignals(s: SiteSignals): string {
  const yn = (b: boolean) => (b ? "yes" : "not detected");
  const list = (a: string[]) => (a.length ? a.join(", ") : "none detected");
  return [
    `- HTTPS: ${yn(s.hasSsl)}`,
    `- Contact form on page: ${yn(s.hasContactForm)}`,
    `- Online booking widget: ${yn(s.hasBookingWidget)}${s.detectedBooking.length ? ` (${list(s.detectedBooking)})` : ""}`,
    `- Live chat widget: ${yn(s.hasLiveChat)}${s.detectedChat.length ? ` (${list(s.detectedChat)})` : ""}`,
    `- AI chatbot claimed on site: ${yn(s.hasChatbot)}`,
    `- Newsletter/email capture: ${yn(s.hasNewsletterCapture)}`,
    `- Click-to-call phone link: ${yn(s.hasPhoneNumber)}`,
    `- Mobile viewport tag: ${yn(s.hasMobileViewport)}`,
    `- Meta description: ${yn(s.hasMetaDescription)}`,
    `- Page title length: ${s.titleLength ?? "unknown"} chars`,
    `- H1 tags: ${s.h1Count}`,
    `- CRM / marketing automation: ${list(s.detectedCrm)}`,
    `- Analytics: ${list(s.detectedAnalytics)}`,
    `- Email marketing: ${list(s.detectedEmailMarketing)}`,
    `- Ecommerce/payments: ${list(s.detectedEcommerce)}`,
    `- Social profiles linked: ${list(s.socialLinks)}`,
    `- Public email addresses found: ${s.emails.length}`,
    `- Page weight: ${Math.round(s.htmlBytes / 1024)} KB, fetched in ${s.fetchMs} ms`,
  ].join("\n");
}

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // The model occasionally prefixes a sentence. Take the outermost object.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("Analysis returned unparseable JSON");
  }
}

/**
 * Coerce the model output into the shape the rest of the system relies on.
 * Anything missing degrades to a neutral value rather than throwing — a lead
 * with a partial analysis is still worth having, and the score gate below
 * decides whether it gets contacted.
 */
function normalise(raw: Record<string, unknown>, input: AnalysisInput): AnalysisResult {
  const rawAnalysis = (raw.analysis ?? {}) as Record<string, unknown>;
  const analysis = {} as LeadAnalysis;
  for (const dim of ANALYSIS_DIMENSIONS) {
    analysis[dim] = toAssessment(rawAnalysis[dim]);
  }

  const opportunities = Array.isArray(raw.opportunities)
    ? (raw.opportunities as unknown[]).slice(0, 4).map(toOpportunity).filter(Boolean as unknown as (o: Opportunity | null) => o is Opportunity)
    : [];

  const disqualifyRaw = raw.disqualify as { reason?: unknown } | null | undefined;
  const disqualify =
    disqualifyRaw && typeof disqualifyRaw === "object" && disqualifyRaw.reason
      ? { reason: String(disqualifyRaw.reason).slice(0, 300) }
      : null;

  // Prefer the model's own score, but never let it claim a high score with no
  // opportunities to back it up.
  const stated = clamp(Number(raw.opportunityScore), 0, 100);
  const derived = opportunities.length
    ? Math.round(opportunities.reduce((a, o) => a + o.score, 0) / opportunities.length)
    : 0;
  const opportunityScore = opportunities.length === 0 ? Math.min(stated || 0, 25) : stated || derived;

  return {
    analysis,
    opportunities,
    summary: typeof raw.summary === "string" ? raw.summary.trim().slice(0, 2000) : "",
    suggestedService:
      typeof raw.suggestedService === "string" && raw.suggestedService.trim()
        ? raw.suggestedService.trim().slice(0, 120)
        : (opportunities[0]?.fortifyService ?? "Workflows"),
    opportunityScore,
    contactName: cleanStr(raw.contactName),
    industry: cleanStr(raw.industry) ?? input.industry ?? null,
    disqualify,
  };
}

function toAssessment(v: unknown): Assessment {
  if (v && typeof v === "object") {
    const o = v as { rating?: unknown; note?: unknown };
    return {
      rating: clamp(Number(o.rating), 1, 5) || 3,
      note: typeof o.note === "string" ? o.note.slice(0, 400) : "",
    };
  }
  return { rating: 3, note: "" };
}

function toOpportunity(v: unknown): Opportunity | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title.trim()) return null;
  const impact = String(o.impact ?? "medium").toLowerCase();
  return {
    title: o.title.trim().slice(0, 160),
    evidence: typeof o.evidence === "string" ? o.evidence.trim().slice(0, 600) : "",
    impact: impact === "high" || impact === "low" ? impact : "medium",
    fortifyService:
      typeof o.fortifyService === "string" && o.fortifyService.trim()
        ? o.fortifyService.trim().slice(0, 120)
        : "Workflows",
    score: clamp(Number(o.score), 0, 100) || 50,
  };
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "unknown") return null;
  return t.slice(0, 200);
}
