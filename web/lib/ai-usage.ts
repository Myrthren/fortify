import { db } from "@/lib/db";
import type { Tier } from "@prisma/client";

const BUDGETS: Record<Tier, number> = {
  FREE:  0,
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

// Get or create today's AI session, returns { session, remainingGbp, packRemainingGbp, overLimit }
export async function getOrCreateSession(userId: string, tier: Tier) {
  const budget = tierBudget(tier);
  if (budget === 0) return { session: null, remainingGbp: 0, packRemainingGbp: 0, overLimit: true };

  const now = new Date();

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

  return { session, remainingGbp: sessionRemaining, packRemainingGbp: packRemaining, overLimit };
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
