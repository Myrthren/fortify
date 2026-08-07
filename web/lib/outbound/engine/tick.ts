import type { OutboundCampaign } from "@prisma/client";
import { db } from "@/lib/db";
import { runDiscovery } from "./discover";
import {
  followUpDueAt,
  isWithinSendWindow,
  nextSendDelayMs,
  sendEmail,
  sentToday,
} from "./send";
import { analyseLead, draftEmail, scrapeLead } from "./stages";
import { Budget, logEvent, recordFailure } from "./shared";

/**
 * The tick — one pass of the outbound employee's working loop.
 *
 * Design rules:
 *  - Bounded. Every tick runs under a wall-clock budget so it fits inside a
 *    serverless invocation. Unfinished work is not lost, it is just next tick's
 *    problem, because progress is written to the lead row at every stage.
 *  - Idempotent per lead. Re-running a tick cannot double-send: the send path
 *    claims its row with a conditional update.
 *  - Cheap stages first. Scraping is free, analysis costs an AI call, sending
 *    costs reputation. Doing them in that order means the expensive steps only
 *    ever run on leads that survived the cheap ones.
 */

const DEFAULT_BUDGET_MS = Number(process.env.OUTBOUND_TICK_BUDGET_MS ?? 20_000);

/** Per-stage ceilings for a single tick, so no one stage starves the others. */
const LIMITS = {
  scrape: 8,
  analyse: 5,
  draft: 5,
  send: 5,
};

export type CampaignTickResult = {
  campaignId: string;
  campaignName: string;
  discovered: number;
  scraped: number;
  analysed: number;
  drafted: number;
  sent: number;
  skippedSend?: string;
  errors: number;
  budgetExhausted: boolean;
};

export async function tickAllCampaigns(
  opts: { budgetMs?: number; userId?: string } = {}
): Promise<CampaignTickResult[]> {
  const budget = new Budget(opts.budgetMs ?? DEFAULT_BUDGET_MS);

  const campaigns = await db.outboundCampaign.findMany({
    where: { status: "ACTIVE", ...(opts.userId ? { userId: opts.userId } : {}) },
    // Least recently ticked first, so a busy campaign cannot starve the others.
    orderBy: { lastTickAt: { sort: "asc", nulls: "first" } },
  });

  const results: CampaignTickResult[] = [];
  for (const campaign of campaigns) {
    if (budget.expired) break;
    results.push(await tickCampaign(campaign, budget));
  }
  return results;
}

export async function tickCampaign(
  campaign: OutboundCampaign,
  budget: Budget
): Promise<CampaignTickResult> {
  const result: CampaignTickResult = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    discovered: 0,
    scraped: 0,
    analysed: 0,
    drafted: 0,
    sent: 0,
    errors: 0,
    budgetExhausted: false,
  };

  // 1. Keep the funnel fed. Starting an Apify run is one fast API call; the
  //    results are collected on a later tick.
  try {
    const discovery = await runDiscovery(campaign);
    result.discovered = discovery.created;
  } catch (e) {
    console.error("[outbound] discovery failed", campaign.id, e);
    result.errors++;
  }

  // 2. Scrape.
  for (const lead of await due(campaign.id, "DISCOVERED", LIMITS.scrape)) {
    if (budget.expired) return finish(campaign, result, true);
    try {
      await scrapeLead(lead);
      result.scraped++;
    } catch (e) {
      await recordFailure(lead.id, "scrape", e);
      result.errors++;
    }
  }

  // 3. Analyse.
  for (const lead of await due(campaign.id, "SCRAPED", LIMITS.analyse)) {
    if (budget.expired) return finish(campaign, result, true);
    try {
      await analyseLead(lead, campaign);
      result.analysed++;
    } catch (e) {
      await recordFailure(lead.id, "analyse", e);
      result.errors++;
    }
  }

  // 4. Draft the first touch.
  for (const lead of await due(campaign.id, "ANALYSED", LIMITS.draft)) {
    if (budget.expired) return finish(campaign, result, true);
    try {
      const { passedGuardrails } = await draftEmail(lead, campaign, 0);
      await db.outboundLead.update({
        where: { id: lead.id },
        data: {
          stage: "DRAFTED",
          // Auto-send only takes over when the draft is clean. A draft that
          // failed guardrails always waits for a human, whatever the setting.
          nextActionAt: campaign.autoSend && passedGuardrails ? new Date() : null,
        },
      });
      result.drafted++;
    } catch (e) {
      await recordFailure(lead.id, "draft", e);
      result.errors++;
    }
  }

  // 5. Draft follow-ups for leads whose wait has elapsed.
  for (const lead of await dueFollowUps(campaign.id, LIMITS.draft)) {
    if (budget.expired) return finish(campaign, result, true);
    const step = lead.followUpStep + 1;
    if (step > campaign.maxFollowUps) {
      await db.outboundLead.update({
        where: { id: lead.id },
        data: { nextActionAt: null },
      });
      continue;
    }
    try {
      const { emailId, passedGuardrails } = await draftEmail(lead, campaign, step);
      if (campaign.autoSend && passedGuardrails) {
        await db.outboundEmail.update({
          where: { id: emailId },
          data: { status: "QUEUED", scheduledAt: new Date() },
        });
        await db.outboundLead.update({
          where: { id: lead.id },
          data: { nextActionAt: new Date() },
        });
      } else {
        // Hold for review, and stop the follow-up clock from re-firing.
        await db.outboundLead.update({
          where: { id: lead.id },
          data: { nextActionAt: null },
        });
      }
      result.drafted++;
    } catch (e) {
      await recordFailure(lead.id, "follow-up draft", e);
      result.errors++;
    }
  }

  // 6. Send whatever is due, subject to window and cap.
  const window = isWithinSendWindow(campaign);
  if (!window.open) {
    result.skippedSend = window.reason;
    return finish(campaign, result, budget.expired);
  }

  let today = await sentToday(campaign.id);
  if (today >= campaign.dailySendCap) {
    result.skippedSend = `daily cap of ${campaign.dailySendCap} reached`;
    return finish(campaign, result, budget.expired);
  }

  const queue = await db.outboundEmail.findMany({
    where: {
      campaignId: campaign.id,
      status: { in: ["QUEUED", "DRAFT"] },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      lead: { stage: { in: ["DRAFTED", "QUEUED", "SENT"] }, nextActionAt: { lte: new Date() } },
    },
    orderBy: [{ step: "desc" }, { createdAt: "asc" }], // finish sequences before starting new ones
    take: LIMITS.send,
    include: { lead: true },
  });

  for (const email of queue) {
    if (budget.expired) return finish(campaign, result, true);
    if (today >= campaign.dailySendCap) {
      result.skippedSend = `daily cap of ${campaign.dailySendCap} reached`;
      break;
    }

    const outcome = await sendEmail(email, email.lead, campaign);
    if (outcome.sent) {
      today++;
      result.sent++;

      // Space the next one out. Applied to the whole campaign, not this lead —
      // the constraint is the sending mailbox, not the recipient.
      const delay = nextSendDelayMs(campaign, today);
      await db.outboundEmail.updateMany({
        where: { campaignId: campaign.id, status: { in: ["QUEUED"] }, scheduledAt: null },
        data: { scheduledAt: new Date(Date.now() + delay) },
      });
      break; // one send per tick keeps the pacing honest
    } else if (outcome.reason !== "already claimed" && outcome.reason !== "suppressed") {
      result.errors++;
    }
  }

  return finish(campaign, result, budget.expired);
}

async function finish(
  campaign: OutboundCampaign,
  result: CampaignTickResult,
  budgetExhausted: boolean
): Promise<CampaignTickResult> {
  result.budgetExhausted = budgetExhausted;
  await db.outboundCampaign.update({
    where: { id: campaign.id },
    data: { lastTickAt: new Date() },
  });
  return result;
}

/** Leads sitting on a stage with their action time due. */
function due(campaignId: string, stage: "DISCOVERED" | "SCRAPED" | "ANALYSED", take: number) {
  return db.outboundLead.findMany({
    where: {
      campaignId,
      stage,
      OR: [{ nextActionAt: null }, { nextActionAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take,
  });
}

/** Sent leads whose follow-up wait has elapsed and who have not replied. */
function dueFollowUps(campaignId: string, take: number) {
  return db.outboundLead.findMany({
    where: {
      campaignId,
      stage: "SENT",
      repliedAt: null,
      nextActionAt: { lte: new Date() },
      // Only chase leads whose latest email actually went out.
      emails: { some: { status: { in: ["SENT", "DELIVERED", "OPENED"] } } },
    },
    orderBy: { nextActionAt: "asc" },
    take,
  });
}

/**
 * Re-arm a lead whose follow-up draft was approved by a human. Exposed for the
 * approve route so the two paths schedule identically.
 */
export async function queueApprovedEmail(emailId: string): Promise<void> {
  const email = await db.outboundEmail.findUnique({
    where: { id: emailId },
    include: { campaign: true },
  });
  if (!email) throw new Error("email not found");

  await db.outboundEmail.update({
    where: { id: emailId },
    data: { status: "QUEUED", scheduledAt: new Date() },
  });
  await db.outboundLead.update({
    where: { id: email.leadId },
    data: { stage: "QUEUED", nextActionAt: new Date() },
  });
  await logEvent(email.leadId, "approved", `Queued "${email.subject}" for sending`, undefined, emailId);
}

export { followUpDueAt };
