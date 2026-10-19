import type { LeadPackSetting, Tier } from "@prisma/client";
import { PACK_SIZE, PACK_TIERS, leadKey, packDue, pickNewLeads, type PackLead } from "@/lib/lead-pack-core";
import { db } from "@/lib/db";
import { getDatasetItems, getRunStatus, startRun } from "@/lib/apify";
import { generateOutreach } from "@/lib/outreach";
import { googleMapsInput, scrapeEmails, type GooglePlaceResult } from "@/lib/recon";
import { sendDMConditional } from "@/lib/notifications";

export { PACK_SIZE, PACK_TIERS, packDue, weekStart, type PackLead } from "@/lib/lead-pack-core";

// Weekly lead pack (Elite and Apex): Recon runs for the member's chosen
// category and location once a week, skips businesses from earlier packs,
// finds published emails and drafts a cold email for each one. Packs are
// stored as ReconSearch rows with filters.pack = true.
//
// It runs from a 15-minute cron in two steps so no request comes near
// Netlify's 60-second limit: one tick starts the Google Maps scrape, a later
// tick collects it and builds the pack. Packs are included in the plan and
// don't spend credits.

const SCRAPE_TIMEOUT_MS = 30 * 60 * 1000; // give up on an Apify run after this

/** Only facts from the listing, so the draft has nothing to invent around. */
function describeLead(lead: PackLead, location: string): string {
  const parts = [`${lead.title} — ${lead.category ?? "local business"} in ${lead.address ?? location}.`];
  if (lead.url) parts.push(`Website: ${lead.url}.`);
  if (lead.rating) parts.push(`Google rating ${lead.rating}${lead.reviewsCount ? ` from ${lead.reviewsCount} reviews` : ""}.`);
  if (!lead.url) parts.push("No website listed on Google Maps.");
  if (lead.description) parts.push(lead.description);
  return parts.join(" ");
}

/** What the member sells: their own words first, then Company DNA, then profile. */
async function memberOffer(setting: LeadPackSetting): Promise<string | null> {
  if (setting.offer?.trim()) return setting.offer.trim();
  const [dna, profile] = await Promise.all([
    db.companyDna.findUnique({ where: { userId: setting.userId }, select: { entries: true } }),
    db.profile.findUnique({ where: { userId: setting.userId }, select: { canOffer: true } }),
  ]);
  const entries = Array.isArray(dna?.entries) ? (dna!.entries as { label?: string; content?: string }[]) : [];
  const fromDna = entries.map((e) => `${e.label ?? ""}: ${e.content ?? ""}`).join("\n").trim();
  if (fromDna) return fromDna.slice(0, 1500);
  if (profile?.canOffer?.length) return profile.canOffer.join(", ");
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

async function deliverPack(setting: LeadPackSetting & { user: { tier: Tier; discordId: string | null } }, deadline: number) {
  const size = PACK_SIZE[setting.user.tier as "ELITE" | "APEX"] ?? PACK_SIZE.ELITE;
  const items = await getDatasetItems<GooglePlaceResult>(setting.pendingRunId!);

  // Skip businesses already delivered in this member's recent packs.
  const previous = await db.reconSearch.findMany({
    where: { userId: setting.userId, filters: { path: ["pack"], equals: true } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { leads: true },
  });
  const seen = new Set<string>();
  for (const p of previous) for (const l of (p.leads as PackLead[]) ?? []) seen.add(leadKey(l));
  const leads = pickNewLeads(items, seen, size);

  const now = new Date();
  if (!leads.length) {
    await db.leadPackSetting.update({
      where: { id: setting.id },
      data: { pendingRunId: null, pendingSince: null, lastRunAt: now, lastError: "No new businesses this week. Try a wider location or another category." },
    });
    return 0;
  }

  // Published emails, then a draft for each lead while time allows.
  await mapLimit(leads, 8, async (lead) => {
    if (!lead.emails?.length && lead.url) lead.emails = (await scrapeEmails(lead.url)) || undefined;
    if (!lead.emails?.length) lead.emails = undefined;
  });

  const offer = await memberOffer(setting);
  if (offer) {
    const voice = await db.brandVoice.findFirst({ where: { userId: setting.userId, isActive: true }, select: { systemPrompt: true } });
    await mapLimit(leads, 6, async (lead) => {
      if (Date.now() > deadline) return;
      try {
        lead.draft = await generateOutreach({
          prospect: describeLead(lead, setting.location),
          offer,
          channel: "cold-email",
          voiceSystemPrompt: voice?.systemPrompt,
        });
      } catch (err: any) {
        console.error(`[lead-pack] draft failed for ${setting.userId}:`, err?.message ?? err);
      }
    });
  }

  const pack = await db.reconSearch.create({
    data: {
      userId: setting.userId,
      location: setting.location,
      category: setting.category,
      filters: { pack: true, drafted: !!offer },
      leads,
      totalLeads: leads.length,
    },
  });
  await db.leadPackSetting.update({
    where: { id: setting.id },
    data: { pendingRunId: null, pendingSince: null, lastRunAt: now, lastError: offer ? null : "Add what you offer to get an outreach draft for each lead." },
  });

  const drafted = leads.filter((l) => l.draft).length;
  const summary = `${leads.length} new ${setting.category} businesses in ${setting.location}${drafted ? `, ${drafted} with outreach drafted` : ""}.`;
  await db.notification.create({
    data: { userId: setting.userId, type: "system", title: "Your weekly lead pack is ready", body: summary, link: `/dashboard/lead-pack#${pack.id}` },
  });
  if (setting.user.discordId) {
    await sendDMConditional(
      setting.user.discordId,
      setting.userId,
      "dmWeeklyReport",
      `Your weekly lead pack is ready: ${summary}\nhttps://fortify-io.com/dashboard/lead-pack`,
    );
  }
  return leads.length;
}

/** One cron tick: finish scrapes that are done, then start packs that are due. */
export async function leadPackTick(deadline: number) {
  const result = { delivered: 0, started: 0, failed: 0, waiting: 0 };
  const now = new Date();

  const pending = await db.leadPackSetting.findMany({
    where: { pendingRunId: { not: null } },
    include: { user: { select: { tier: true, discordId: true } } },
  });
  for (const setting of pending) {
    if (Date.now() > deadline) break;
    try {
      const status = await getRunStatus(setting.pendingRunId!);
      const stale = setting.pendingSince && now.getTime() - setting.pendingSince.getTime() > SCRAPE_TIMEOUT_MS;
      if (status !== "SUCCEEDED" && !(["FAILED", "ABORTED", "TIMED-OUT"].includes(status) || stale)) {
        result.waiting++;
        continue;
      }
      if (status !== "SUCCEEDED") {
        await db.leadPackSetting.update({
          where: { id: setting.id },
          data: { pendingRunId: null, pendingSince: null, lastRunAt: now, lastError: "This week's search didn't finish. The next pack will run on Monday, or save your settings to retry now." },
        });
        result.failed++;
        continue;
      }
      if (!PACK_TIERS.includes(setting.user.tier)) {
        await db.leadPackSetting.update({ where: { id: setting.id }, data: { pendingRunId: null, pendingSince: null } });
        continue;
      }
      await deliverPack(setting, deadline);
      result.delivered++;
    } catch (err: any) {
      console.error(`[lead-pack] finishing ${setting.userId} failed:`, err?.message ?? err);
      result.failed++;
    }
  }

  const candidates = await db.leadPackSetting.findMany({
    where: { enabled: true, pendingRunId: null, user: { tier: { in: PACK_TIERS } } },
    include: { user: { select: { tier: true } } },
    take: 100,
  });
  for (const setting of candidates) {
    if (Date.now() > deadline) break;
    if (!packDue(setting.lastRunAt, now)) continue;
    try {
      const size = PACK_SIZE[setting.user.tier as "ELITE" | "APEX"] ?? PACK_SIZE.ELITE;
      // Ask for extra places so there is room after skipping earlier packs.
      const runId = await startRun("google-maps", googleMapsInput(setting.category, setting.location, Math.min(size * 3, 75)));
      await db.leadPackSetting.update({ where: { id: setting.id }, data: { pendingRunId: runId, pendingSince: now, lastError: null } });
      result.started++;
    } catch (err: any) {
      console.error(`[lead-pack] starting ${setting.userId} failed:`, err?.message ?? err);
      result.failed++;
    }
  }

  return result;
}
