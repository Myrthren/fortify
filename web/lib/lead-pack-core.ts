import type { Tier } from "@prisma/client";
import type { GooglePlaceResult } from "./recon";

// Pure parts of the weekly lead pack (no database or network), kept apart so
// they can be unit-tested with plain Node. See lib/lead-pack.ts.

export const PACK_SIZE: Record<"ELITE" | "APEX", number> = { ELITE: 15, APEX: 25 };
export const PACK_TIERS: Tier[] = ["ELITE", "APEX"];
const DELIVERY_HOUR_UTC = 6; // Monday 06:00 UTC

export type PackLead = {
  title: string;
  url: string;
  description: string;
  phone?: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  category?: string;
  emails?: string[];
  draft?: string;
};

/** Most recent Monday 06:00 UTC at or before `now`. */
export function weekStart(now: Date): Date {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday, DELIVERY_HOUR_UTC));
  if (start > now) start.setUTCDate(start.getUTCDate() - 7);
  return start;
}

/** First pack straight away, then one per week from Monday morning. */
export function packDue(lastRunAt: Date | null, now: Date): boolean {
  return !lastRunAt || lastRunAt < weekStart(now);
}

export function leadKey(lead: { title?: string; address?: string }): string {
  return `${(lead.title ?? "").trim().toLowerCase()}|${(lead.address ?? "").trim().toLowerCase()}`;
}

/** Turns scrape results into new leads: open businesses not delivered before. */
export function pickNewLeads(items: GooglePlaceResult[], seen: Set<string>, size: number): PackLead[] {
  const picked: PackLead[] = [];
  for (const r of items) {
    if (picked.length >= size) break;
    if (r.permanentlyClosed || r.temporarilyClosed || !r.title) continue;
    const lead: PackLead = {
      title: r.title,
      url: r.website ?? "",
      description: r.description ?? "",
      phone: r.phone ?? undefined,
      address: r.address ?? undefined,
      rating: r.totalScore ?? undefined,
      reviewsCount: r.reviewsCount ?? undefined,
      category: r.categoryName ?? undefined,
      emails: r.emails?.length ? r.emails : undefined,
    };
    const key = leadKey(lead);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(lead);
  }
  return picked;
}
