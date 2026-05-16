import { db } from "@/lib/db";
import type { Tier } from "@prisma/client";

// ─── The capacity formula lives here ONLY — never exposed to the client ────────

const BASE_UNITS: Record<Tier, number> = {
  FREE:  0,
  PRO:   0,
  ELITE: 10_000,
  APEX:  999_999_999, // effectively unlimited
};

/** How many workflow capacity units the user has earned this month (base + purchased) */
export async function getCapacityInfo(userId: string, tier: Tier) {
  // Base allowance for this tier
  const base = BASE_UNITS[tier] ?? 0;

  // Extra units from all capacity packs they have ever bought
  const packs = await db.workflowCapacityPack.findMany({
    where: { userId },
    select: { units: true },
  });
  const extra = packs.reduce((sum, p) => sum + p.units, 0);
  const total = tier === "APEX" ? 999_999_999 : base + extra;

  // Usage = sum of usedCapacity on runs started in the last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const runsAgg = await db.workflowRun.aggregate({
    where: {
      workflow: { userId },
      startedAt: { gte: since },
    },
    _sum: { usedCapacity: true },
  });
  const used = runsAgg._sum.usedCapacity ?? 0;

  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return { used, total, remaining, pct, isUnlimited: tier === "APEX" };
}

export const CAPACITY_PACKS = [
  { id: "wf_cap_5k",  units: 5_000,  price: "9.99",  label: "5,000 units",  description: "~50 workflow runs" },
  { id: "wf_cap_12k", units: 12_000, price: "19.99", label: "12,000 units", description: "~120 workflow runs" },
] as const;

export type CapPackId = (typeof CAPACITY_PACKS)[number]["id"];

export function getCapPackById(id: string) {
  return CAPACITY_PACKS.find((p) => p.id === id) ?? null;
}
