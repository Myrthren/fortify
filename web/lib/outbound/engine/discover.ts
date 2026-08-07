import type { OutboundCampaign } from "@prisma/client";
import { db } from "@/lib/db";
import { getDiscoveryProvider } from "@/lib/outbound/registry";
import type { DiscoveredBusiness, DiscoveryInput } from "@/lib/outbound/types";
import { domainOfEmail, isSuppressed, logEvent, toDomain } from "./shared";

/** A two-phase discovery run older than this is assumed dead and abandoned. */
const JOB_TIMEOUT_MS = 30 * 60_000;
/** How many to ask for in one go. Keeps per-run cost predictable. */
const BATCH_SIZE = 40;

export type DiscoverOutcome = {
  started: boolean;
  collected: number;
  created: number;
  skipped: number;
  status: "idle" | "running" | "collected" | "started" | "failed";
  error?: string;
};

/**
 * Keep the campaign stocked with leads.
 *
 * Called once per tick. Does at most one thing: collect a finished job, start a
 * new one, or run a synchronous provider. Never both, so a tick's cost stays
 * bounded and predictable.
 */
export async function runDiscovery(
  campaign: OutboundCampaign
): Promise<DiscoverOutcome> {
  const base: DiscoverOutcome = {
    started: false,
    collected: 0,
    created: 0,
    skipped: 0,
    status: "idle",
  };

  const provider = getDiscoveryProvider(campaign.discoveryProvider);

  // 1. A job is in flight — poll it, and nothing else this tick.
  if (campaign.discoveryJobId && provider.pollJob) {
    const age = Date.now() - (campaign.discoveryJobStartedAt?.getTime() ?? 0);
    if (age > JOB_TIMEOUT_MS) {
      await clearJob(campaign.id, `Discovery run abandoned after ${Math.round(age / 60000)} minutes`);
      return { ...base, status: "failed", error: "discovery run timed out" };
    }

    let poll;
    try {
      poll = await provider.pollJob(campaign.discoveryJobId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await clearJob(campaign.id, msg);
      return { ...base, status: "failed", error: msg };
    }

    if (poll.status === "running") return { ...base, status: "running" };

    if (poll.status === "failed") {
      await clearJob(campaign.id, poll.error);
      return { ...base, status: "failed", error: poll.error };
    }

    const result = await ingest(campaign, poll.results);
    await db.outboundCampaign.update({
      where: { id: campaign.id },
      data: {
        discoveryJobId: null,
        discoveryJobStartedAt: null,
        lastDiscoveryAt: new Date(),
        lastError: null,
      },
    });
    return {
      ...base,
      status: "collected",
      collected: poll.results.length,
      created: result.created,
      skipped: result.skipped,
    };
  }

  // 2. No job running. Only source more if we are actually short.
  const live = await db.outboundLead.count({
    where: {
      campaignId: campaign.id,
      stage: { notIn: ["DISQUALIFIED", "BOUNCED", "UNSUBSCRIBED"] },
    },
  });
  if (live >= campaign.leadTarget) return base;

  const want = Math.min(BATCH_SIZE, campaign.leadTarget - live);
  const input: DiscoveryInput = {
    query: campaign.targetQuery ?? campaign.industry ?? campaign.name,
    location: campaign.location,
    industry: campaign.industry,
    limit: want,
  };

  // 3a. Two-phase provider: fire and collect on a later tick.
  if (provider.startJob) {
    try {
      const jobId = await provider.startJob(input);
      await db.outboundCampaign.update({
        where: { id: campaign.id },
        data: {
          discoveryJobId: jobId,
          discoveryJobStartedAt: new Date(),
          lastError: null,
        },
      });
      return { ...base, started: true, status: "started" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.outboundCampaign.update({
        where: { id: campaign.id },
        data: { lastError: msg.slice(0, 500) },
      });
      return { ...base, status: "failed", error: msg };
    }
  }

  // 3b. Synchronous provider: results now.
  if (provider.discover) {
    try {
      const results = await provider.discover(input);
      const result = await ingest(campaign, results);
      await db.outboundCampaign.update({
        where: { id: campaign.id },
        data: { lastDiscoveryAt: new Date(), lastError: null },
      });
      return {
        ...base,
        status: "collected",
        collected: results.length,
        created: result.created,
        skipped: result.skipped,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.outboundCampaign.update({
        where: { id: campaign.id },
        data: { lastError: msg.slice(0, 500) },
      });
      return { ...base, status: "failed", error: msg };
    }
  }

  return { ...base, status: "failed", error: "provider implements neither discover nor startJob" };
}

async function clearJob(campaignId: string, error?: string) {
  await db.outboundCampaign.update({
    where: { id: campaignId },
    data: {
      discoveryJobId: null,
      discoveryJobStartedAt: null,
      lastError: error?.slice(0, 500) ?? null,
    },
  });
}

/**
 * Turn raw discoveries into leads.
 *
 * Dedupe is per-user on domain, enforced both here and by a unique index — the
 * index is the real guarantee, since two ticks can race. A business with no
 * resolvable domain is dropped: without a website there is nothing to analyse,
 * and a generic email with no site produces exactly the invented-observation
 * email this system exists to avoid.
 */
async function ingest(
  campaign: OutboundCampaign,
  businesses: DiscoveredBusiness[]
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const b of businesses) {
    const domain = toDomain(b.website) ?? domainOfEmail(b.email);
    if (!domain) {
      skipped++;
      continue;
    }

    if (await isSuppressed(campaign.userId, b.email, domain)) {
      skipped++;
      continue;
    }

    try {
      const lead = await db.outboundLead.create({
        data: {
          userId: campaign.userId,
          campaignId: campaign.id,
          company: b.company.slice(0, 200),
          website: b.website ?? `https://${domain}`,
          domain,
          email: b.email ?? null,
          phone: b.phone ?? null,
          contactName: b.contactName ?? null,
          industry: b.industry ?? campaign.industry,
          location: b.location ?? campaign.location,
          source: campaign.discoveryProvider,
          stage: "DISCOVERED",
          nextActionAt: new Date(),
        },
      });
      await logEvent(lead.id, "discovered", `Found via ${campaign.discoveryProvider}`, {
        raw: b.raw,
      });
      created++;
    } catch (e) {
      // P2002 = the unique (userId, domain) index caught a duplicate. Expected.
      if ((e as { code?: string }).code === "P2002") skipped++;
      else throw e;
    }
  }

  return { created, skipped };
}
