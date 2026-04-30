import type { Tier } from "@prisma/client";

// Same source of truth as web/lib/tiers.ts
export const TIER_LIMITS = {
  FREE: { dailyGenerations: 10, brandVoices: 0, monthlyAudits: 0, monthlyOutreach: 0, watchTerms: 0, competitors: 0 },
  PRO: { dailyGenerations: Infinity, brandVoices: 1, monthlyAudits: 5, monthlyOutreach: 50, watchTerms: 0, competitors: 3 },
  ELITE: { dailyGenerations: Infinity, brandVoices: 3, monthlyAudits: Infinity, monthlyOutreach: Infinity, watchTerms: 10, competitors: 10 },
  APEX: { dailyGenerations: Infinity, brandVoices: Infinity, monthlyAudits: Infinity, monthlyOutreach: Infinity, watchTerms: Infinity, competitors: Infinity },
} as const satisfies Record<Tier, unknown>;

export const TIER_NAMES: Record<Tier, string> = {
  FREE: "Free",
  PRO: "Pro",
  ELITE: "Elite",
  APEX: "Apex",
};
