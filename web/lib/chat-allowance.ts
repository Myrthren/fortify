import type { Tier } from "@prisma/client";

// Model-usage allowances, not additional subscription charges or tool credits.
export const FREE_TRIAL_BUDGET_GBP = 0.20;
export const CHAT_BUDGET_GBP: Record<Tier, number> = { FREE: 0, PRO: 1, ELITE: 5, APEX: 999999 };
