import type { Tier } from "@prisma/client";

export const TIERS = {
  FREE: { name: "Recruit", price: 0, planId: null },
  PRO: { name: "Soldier", price: 29, planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO },
  ELITE: { name: "Knight", price: 79, planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ELITE },
  APEX: { name: "Apex", price: 199, planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_APEX },
} as const;

export const PLAN_TO_TIER: Record<string, Tier> = {
  [process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO ?? ""]: "PRO",
  [process.env.NEXT_PUBLIC_PAYPAL_PLAN_ELITE ?? ""]: "ELITE",
  [process.env.NEXT_PUBLIC_PAYPAL_PLAN_APEX ?? ""]: "APEX",
};

export const TIER_TO_ROLE_ID: Record<Tier, string | undefined> = {
  FREE: undefined,
  PRO: process.env.DISCORD_ROLE_PRO,
  ELITE: process.env.DISCORD_ROLE_ELITE,
  APEX: process.env.DISCORD_ROLE_APEX,
};

export const TIER_LIMITS = {
  FREE: { dailyGenerations: 10, brandVoices: 0, audits: 0, watchTerms: 0 },
  PRO: { dailyGenerations: Infinity, brandVoices: 1, audits: 5, watchTerms: 0 },
  ELITE: { dailyGenerations: Infinity, brandVoices: 3, audits: Infinity, watchTerms: 10 },
  APEX: { dailyGenerations: Infinity, brandVoices: Infinity, audits: Infinity, watchTerms: Infinity },
} as const;
