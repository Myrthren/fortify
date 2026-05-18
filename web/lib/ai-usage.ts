import { db } from "@/lib/db";
import type { Tier } from "@prisma/client";

export const FREE_TRIAL_BUDGET_GBP = 0.20; // one-time trial for FREE tier

const BUDGETS: Record<Tier, number> = {
  FREE:  0,      // handled separately via FREE_TRIAL_BUDGET_GBP
  PRO:   1,
  ELITE: 5,
  APEX:  999999,
};

export function tierBudget(tier: Tier): number {
  return BUDGETS[tier];
}

// Cost in GBP for token usage
export function estimateCost(inputTokens: number, outputTokens: number, hasImage = false): number {
  const input = (inputTokens / 1000) * 0.0024;
  const output = (outputTokens / 1000) * 0.012;
  const img = hasImage ? 0.004 : 0;
  return input + output + img;
}

// Get or create today's AI session, returns { session, remainingGbp, packRemainingGbp, overLimit, freeTrialExhausted }
export async function getOrCreateSession(userId: string, tier: Tier) {
  const now = new Date();

  // ── FREE tier: one-time £0.20 trial ──────────────────────────────────────────
  if (tier === "FREE") {
    // Look for existing trial session
    let session = await db.aiSession.findFirst({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { startedAt: "desc" },
    });

    if (!session) {
      // Check if they've already used (and exhausted) their trial
      const user = await db.user.findUnique({ where: { id: userId }, select: { freeAiUsed: true } });
      if (!user || user.freeAiUsed) {
        return { session: null, remainingGbp: 0, packRemainingGbp: 0, overLimit: true, freeTrialExhausted: true };
      }
      // First time — create a long-lived trial session (1 year), budget £0.20
      const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      session = await db.aiSession.create({
        data: { userId, expiresAt, budgetGbp: FREE_TRIAL_BUDGET_GBP },
      });
      // Mark trial as started so it doesn't reset
      await db.user.update({ where: { id: userId }, data: { freeAiUsed: true } });
    }

    const sessionRemaining = Math.max(0, session.budgetGbp - session.usedCostGbp);
    const overLimit = sessionRemaining <= 0;

    return {
      session,
      remainingGbp: sessionRemaining,
      packRemainingGbp: 0,
      overLimit,
      freeTrialExhausted: overLimit,
    };
  }

  // ── Paid tiers ────────────────────────────────────────────────────────────────
  const budget = tierBudget(tier);
  if (budget === 0) {
    return { session: null, remainingGbp: 0, packRemainingGbp: 0, overLimit: true, freeTrialExhausted: false };
  }

  // Find active session
  let session = await db.aiSession.findFirst({
    where: { userId, expiresAt: { gt: now } },
    orderBy: { startedAt: "desc" },
  });

  if (!session) {
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    session = await db.aiSession.create({
      data: { userId, expiresAt, budgetGbp: budget },
    });
  }

  const sessionRemaining = Math.max(0, session.budgetGbp - session.usedCostGbp);

  // Find active credit packs (not exhausted)
  const packs = await db.aiCreditPack.findMany({
    where: { userId, exhaustedAt: null },
    orderBy: { purchasedAt: "asc" },
  });
  const packRemaining = packs.reduce((sum, p) => sum + Math.max(0, p.budgetGbp - p.usedCostGbp), 0);

  const overLimit = sessionRemaining <= 0 && packRemaining <= 0 && tier !== "APEX";

  return {
    session,
    remainingGbp: sessionRemaining,
    packRemainingGbp: packRemaining,
    overLimit,
    freeTrialExhausted: false,
  };
}

// Deduct cost from session, then from packs if session exhausted
export async function deductCost(userId: string, tier: Tier, costGbp: number) {
  if (tier === "APEX") return; // unlimited

  const now = new Date();
  const session = await db.aiSession.findFirst({
    where: { userId, expiresAt: { gt: now } },
    orderBy: { startedAt: "desc" },
  });

  if (!session) return;

  const sessionRemaining = Math.max(0, session.budgetGbp - session.usedCostGbp);

  if (tier === "FREE") {
    // FREE trial: only deduct from session (no packs)
    await db.aiSession.update({
      where: { id: session.id },
      data: { usedCostGbp: { increment: Math.min(costGbp, sessionRemaining) } },
    });
    return;
  }

  if (sessionRemaining >= costGbp) {
    await db.aiSession.update({
      where: { id: session.id },
      data: { usedCostGbp: { increment: costGbp } },
    });
    return;
  }

  // Partially deduct from session, rest from packs
  const fromSession = sessionRemaining;
  const fromPacks = costGbp - fromSession;

  await db.aiSession.update({
    where: { id: session.id },
    data: { usedCostGbp: { increment: fromSession } },
  });

  // Deduct from packs in order
  let remaining = fromPacks;
  const packs = await db.aiCreditPack.findMany({
    where: { userId, exhaustedAt: null },
    orderBy: { purchasedAt: "asc" },
  });

  for (const pack of packs) {
    if (remaining <= 0) break;
    const packAvail = Math.max(0, pack.budgetGbp - pack.usedCostGbp);
    const deduct = Math.min(packAvail, remaining);
    const newUsed = pack.usedCostGbp + deduct;
    await db.aiCreditPack.update({
      where: { id: pack.id },
      data: {
        usedCostGbp: newUsed,
        exhaustedAt: newUsed >= pack.budgetGbp ? new Date() : undefined,
      },
    });
    remaining -= deduct;
  }
}
