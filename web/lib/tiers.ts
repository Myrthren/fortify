import type { Tier } from "@prisma/client";

export const TIERS = {
  FREE: { name: "Free", price: 0, planId: null },
  PRO: { name: "Pro", price: 29, planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO },
  ELITE: { name: "Elite", price: 79, planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ELITE },
  APEX: { name: "Apex", price: 199, planId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_APEX },
} as const;

export const PLAN_TO_TIER: Record<string, Tier> = {
  [process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO ?? ""]: "PRO",
  [process.env.NEXT_PUBLIC_PAYPAL_PLAN_ELITE ?? ""]: "ELITE",
  [process.env.NEXT_PUBLIC_PAYPAL_PLAN_APEX ?? ""]: "APEX",
};

export const TIER_TO_ROLE_ID: Record<Tier, string | undefined> = {
  FREE: undefined,
  PRO: "1497408012816744568",
  ELITE: "1497408076486148247",
  APEX: "1497408133444931664",
};

export const TIER_LIMITS = {
  FREE:  { dailyGenerations: 10,       brandVoices: 0,        monthlyAudits: 0,        monthlyOutreach: 10,       watchTerms: 5,        competitors: 0,        redditTrends: false, contentInspiration: false, ytCommentIntel: false, leadSourcing: false, metaAds: false, virality: false,              autoPublish: false, monthlyCredits: 0,    leadSourcingCost: 50 },
  PRO:   { dailyGenerations: Infinity, brandVoices: 1,        monthlyAudits: 5,        monthlyOutreach: 50,       watchTerms: 10,       competitors: 3,        redditTrends: false, contentInspiration: true,  ytCommentIntel: false, leadSourcing: true,  metaAds: true,  virality: false,              autoPublish: false, monthlyCredits: 500,  leadSourcingCost: 50 },
  ELITE: { dailyGenerations: Infinity, brandVoices: 3,        monthlyAudits: Infinity, monthlyOutreach: Infinity, watchTerms: Infinity, competitors: 10,       redditTrends: true,  contentInspiration: true,  ytCommentIntel: true,  leadSourcing: true,  metaAds: true,  virality: true,               autoPublish: false, monthlyCredits: 1500, leadSourcingCost: 50 },
  APEX:  { dailyGenerations: Infinity, brandVoices: Infinity, monthlyAudits: Infinity, monthlyOutreach: Infinity, watchTerms: Infinity, competitors: Infinity, redditTrends: true,  contentInspiration: true,  ytCommentIntel: true,  leadSourcing: true,  metaAds: true,  virality: true,               autoPublish: true,  monthlyCredits: 5000, leadSourcingCost: 50 },
} as const;
