import { db } from "./db";
import type { Tier } from "@prisma/client";
import { TIER_LIMITS } from "./tiers";

/** Find or create a User row keyed by Discord ID. */
export async function getOrCreateUser(discordId: string, name?: string) {
  const existing = await db.user.findUnique({ where: { discordId } });
  if (existing) return existing;
  return db.user.create({ data: { discordId, name: name ?? null } });
}

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

export async function checkMonthly(
  userId: string,
  type: string,
  limit: number,
): Promise<{ ok: boolean; used: number; limit: number }> {
  if (limit === Infinity) return { ok: true, used: 0, limit: Infinity };
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const used = await db.generation.count({
    where: { userId, type, createdAt: { gte: since } },
  });
  return { ok: used < limit, used, limit };
}

export async function logGeneration(
  userId: string,
  type: string,
  input: string,
  output: string,
) {
  await db.generation.create({ data: { userId, type, input, output } });
}
