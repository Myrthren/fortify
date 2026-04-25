import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import type { Tier } from "@prisma/client";

/**
 * Returns true if the user can run another generation today.
 * Free users: 10/day. Paid: unlimited.
 */
export async function canGenerate(userId: string, tier: Tier): Promise<boolean> {
  const limit = TIER_LIMITS[tier].dailyGenerations;
  if (limit === Infinity) return true;

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const count = await db.generation.count({
    where: { userId, createdAt: { gte: since } },
  });
  return count < limit;
}

export async function logGeneration(opts: {
  userId: string;
  type: string;
  input: string;
  output: string;
}) {
  await db.generation.create({ data: opts });
}
