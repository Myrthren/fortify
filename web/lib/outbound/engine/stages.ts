import type { OutboundCampaign, OutboundLead } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getAnalysisProvider,
  getComposeProvider,
  getScrapeProvider,
} from "@/lib/outbound/registry";
import { checkEmail, violationsToInstruction } from "@/lib/outbound/guardrails";
import { rollVariation } from "@/lib/outbound/variation";
import type {
  AnalysisResult,
  ComposeInput,
  ComposedEmail,
  Opportunity,
  ScrapedSite,
} from "@/lib/outbound/types";
import { isSendableEmail, isSuppressed, logEvent, toDomain } from "./shared";

/**
 * The per-lead stages: scrape -> analyse -> draft.
 *
 * Each function takes a lead on one stage and leaves it on the next, or on
 * DISQUALIFIED. They never throw for expected conditions (no site, poor fit,
 * no email) — those are outcomes, recorded on the lead. They do throw for
 * genuine faults, which the caller turns into a retry via recordFailure.
 */

// ─── Scrape ───────────────────────────────────────────────

export async function scrapeLead(lead: OutboundLead): Promise<void> {
  if (!lead.website) {
    await disqualify(lead.id, "No website to analyse");
    return;
  }

  const provider = getScrapeProvider();
  let site: ScrapedSite;
  try {
    site = await provider.scrape(lead.website);
  } catch (e) {
    // A site that will not load is not a fault on our side, it is a dead lead —
    // but only after the retry budget in recordFailure has been spent.
    throw new Error(`scrape failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Harvest a contact address if discovery did not supply one. Prefer an
  // address on the company's own domain over anything else on the page.
  let email = lead.email;
  if (!isSendableEmail(email)) {
    const own = site.signals.emails.find(
      (e) => lead.domain && e.endsWith(`@${lead.domain}`) && isSendableEmail(e)
    );
    email = own ?? site.signals.emails.find(isSendableEmail) ?? null;
  }

  await db.outboundLead.update({
    where: { id: lead.id },
    data: {
      stage: "SCRAPED",
      scrapedText: site.text,
      scrapedPages: site.pages.map((p) => ({
        url: p.url,
        title: p.title,
        chars: p.text.length,
      })) as never,
      scrapedAt: new Date(),
      email,
      domain: lead.domain ?? toDomain(site.finalUrl),
      nextActionAt: new Date(),
      lastError: null,
      // Signals live on the analysis blob so the lead page can show them even
      // before the AI pass has run.
      analysis: { signals: site.signals } as never,
    },
  });

  await logEvent(lead.id, "scraped", `Read ${site.pages.length} page(s)`, {
    pages: site.pages.map((p) => p.url),
    signals: site.signals,
  });
}

// ─── Analyse ──────────────────────────────────────────────

export async function analyseLead(
  lead: OutboundLead,
  campaign: OutboundCampaign
): Promise<void> {
  const provider = getAnalysisProvider();

  const signals = (lead.analysis as { signals?: ScrapedSite["signals"] } | null)?.signals ?? null;
  const site: ScrapedSite | null =
    lead.scrapedText && signals
      ? {
          finalUrl: lead.website ?? "",
          pages: [],
          text: lead.scrapedText,
          signals,
        }
      : null;

  const result = await provider.analyse({
    company: lead.company,
    website: lead.website,
    industry: lead.industry,
    location: lead.location,
    site,
    offer: campaign.offer ?? DEFAULT_OFFER,
  });

  await db.outboundLead.update({
    where: { id: lead.id },
    data: {
      analysis: { ...result.analysis, signals } as never,
      opportunities: result.opportunities as never,
      opportunityScore: result.opportunityScore,
      summary: result.summary,
      suggestedService: result.suggestedService,
      contactName: lead.contactName ?? result.contactName,
      industry: lead.industry ?? result.industry,
      analysedAt: new Date(),
      stage: "ANALYSED",
      nextActionAt: new Date(),
      lastError: null,
    },
  });

  await logEvent(
    lead.id,
    "analysed",
    `Score ${result.opportunityScore}, ${result.opportunities.length} opportunit${result.opportunities.length === 1 ? "y" : "ies"}`,
    { suggestedService: result.suggestedService }
  );

  // Gate before writing anything. Every check here saves an AI call and, more
  // importantly, stops a bad-fit email going out.
  if (result.disqualify) {
    await disqualify(lead.id, result.disqualify.reason);
    return;
  }
  if (result.opportunityScore < campaign.minOpportunityScore) {
    await disqualify(
      lead.id,
      `Opportunity score ${result.opportunityScore} is below the campaign threshold of ${campaign.minOpportunityScore}`
    );
    return;
  }

  const fresh = await db.outboundLead.findUnique({ where: { id: lead.id } });
  if (!isSendableEmail(fresh?.email)) {
    await disqualify(lead.id, "No usable contact email found");
    return;
  }
  if (await isSuppressed(lead.userId, fresh!.email, fresh!.domain)) {
    await disqualify(lead.id, "On the do-not-contact list");
    return;
  }
}

const DEFAULT_OFFER =
  "Fortify — AI automation and business systems: lead sourcing, automated personalised outreach, multi-step workflow automation, competitor tracking and analytics, built and run for the client.";

// ─── Draft ────────────────────────────────────────────────

/** How many rewrites the guardrails get before we accept the best attempt. */
const MAX_COMPOSE_ATTEMPTS = 3;

export async function draftEmail(
  lead: OutboundLead,
  campaign: OutboundCampaign,
  step: number
): Promise<{ emailId: string; passedGuardrails: boolean }> {
  const provider = getComposeProvider();
  const variation = rollVariation(lead.id, step);

  const opportunities = (lead.opportunities as unknown as Opportunity[] | null) ?? [];
  const analysis: AnalysisResult | null = lead.analysedAt
    ? {
        analysis: lead.analysis as never,
        opportunities,
        summary: lead.summary ?? "",
        suggestedService: lead.suggestedService ?? "",
        opportunityScore: lead.opportunityScore ?? 0,
      }
    : null;

  const [previous, voice, recent] = await Promise.all([
    step > 0
      ? db.outboundEmail.findMany({
          where: { leadId: lead.id, status: { in: ["SENT", "DELIVERED", "OPENED"] } },
          orderBy: { step: "asc" },
          select: { subject: true, body: true, sentAt: true },
        })
      : Promise.resolve([]),
    campaign.brandVoiceId
      ? db.brandVoice.findUnique({
          where: { id: campaign.brandVoiceId },
          select: { systemPrompt: true },
        })
      : Promise.resolve(null),
    recentOutput(campaign.id, lead.id),
  ]);

  const input: ComposeInput = {
    lead: {
      company: lead.company,
      contactName: lead.contactName,
      website: lead.website,
      industry: lead.industry,
      location: lead.location,
    },
    analysis,
    offer: campaign.offer ?? DEFAULT_OFFER,
    sender: {
      name: campaign.senderName ?? "Kene",
      title: campaign.senderTitle,
      email: campaign.senderEmail ?? process.env.OUTBOUND_FROM_EMAIL ?? "",
    },
    variation,
    step,
    previousEmails: previous,
    voiceSystemPrompt: voice?.systemPrompt ?? null,
    avoidPhrases: recent.phrases,
  };

  let best: ComposedEmail | null = null;
  let bestViolations = Number.POSITIVE_INFINITY;
  let passed = false;
  let attemptInput = input;

  for (let attempt = 1; attempt <= MAX_COMPOSE_ATTEMPTS; attempt++) {
    const draft = await provider.compose(attemptInput);
    const check = checkEmail(draft, {
      opportunities,
      recentBodies: recent.bodies,
      company: lead.company,
      contactName: lead.contactName,
    });

    if (check.ok) {
      best = draft;
      passed = true;
      break;
    }

    // Keep the least-bad attempt so a stubborn lead still produces something a
    // human can edit, rather than nothing at all.
    if (check.violations.length < bestViolations) {
      best = draft;
      bestViolations = check.violations.length;
    }

    await logEvent(
      lead.id,
      "guardrail",
      `Attempt ${attempt} rejected: ${check.violations.map((x) => x.detail).join("; ")}`,
      { violations: check.violations }
    );

    attemptInput = {
      ...input,
      avoidPhrases: [
        ...(input.avoidPhrases ?? []),
        violationsToInstruction(check.violations),
      ],
    };
  }

  if (!best) throw new Error("composer returned nothing");

  const email = await db.outboundEmail.create({
    data: {
      leadId: lead.id,
      campaignId: campaign.id,
      step,
      status: "DRAFT",
      subject: best.subject || `${lead.company}`,
      body: best.body,
      variation: variation as never,
      model: best.model,
      wordCount: best.body.trim().split(/\s+/).filter(Boolean).length,
      fromEmail: campaign.senderEmail,
      toEmail: lead.email,
    },
  });

  await logEvent(
    lead.id,
    "drafted",
    passed
      ? `Draft ${step === 0 ? "written" : `follow-up ${step} written`}`
      : `Draft written but failed guardrails after ${MAX_COMPOSE_ATTEMPTS} attempts — needs review`,
    { step, passedGuardrails: passed },
    email.id
  );

  return { emailId: email.id, passedGuardrails: passed };
}

/**
 * Openers and subjects already used across this campaign, fed back into the
 * composer so it drifts away from whatever it has been converging on. Without
 * this, model output across a large campaign narrows over time even with the
 * variation dice.
 */
async function recentOutput(
  campaignId: string,
  excludeLeadId: string
): Promise<{ phrases: string[]; bodies: string[] }> {
  const rows = await db.outboundEmail.findMany({
    where: { campaignId, leadId: { not: excludeLeadId } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { subject: true, body: true },
  });

  const phrases = new Set<string>();
  for (const r of rows) {
    if (r.subject) phrases.add(r.subject);
    const firstLine = r.body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .find((l) => l.split(/\s+/).length > 4);
    if (firstLine) phrases.add(firstLine.slice(0, 160));
  }

  return { phrases: [...phrases], bodies: rows.map((r) => r.body) };
}

async function disqualify(leadId: string, reason: string): Promise<void> {
  await db.outboundLead.update({
    where: { id: leadId },
    data: {
      stage: "DISQUALIFIED",
      disqualifiedReason: reason.slice(0, 400),
      nextActionAt: null,
    },
  });
  await logEvent(leadId, "disqualified", reason);
}
