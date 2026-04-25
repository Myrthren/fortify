import { db } from "./db";
import type { Tier } from "@prisma/client";

const LIMITS: Record<Tier, number> = {
  FREE: 10,
  PRO: Infinity,
  ELITE: Infinity,
  APEX: Infinity,
};

/** Find or create a User row keyed by Discord ID. */
export async function getOrCreateUser(discordId: string, name?: string) {
  const existing = await db.user.findUnique({ where: { discordId } });
  if (existing) return existing;
  return db.user.create({ data: { discordId, name: name ?? null } });
}

export async function canGenerate(userId: string, tier: Tier): Promise<boolean> {
  const limit = LIMITS[tier];
  if (limit === Infinity) return true;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const count = await db.generation.count({
    where: { userId, createdAt: { gte: since } },
  });
  return count < limit;
}

export async function logGeneration(userId: string, type: string, input: string, output: string) {
  await db.generation.create({ data: { userId, type, input, output } });
}
