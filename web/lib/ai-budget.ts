import { randomUUID } from "node:crypto";
import { db } from "./db";

export const WEEKLY_CLAUDE_GBP: Record<string, number> = { FREE: 0, PRO: 2, ELITE: 4, APEX: 10 };
export function weeklyLimitMicros(tier: string): number {
  const configured = process.env[`AI_WEEKLY_CLAUDE_GBP_${tier}`];
  const amount = configured === undefined ? WEEKLY_CLAUDE_GBP[tier] : Number(configured);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000) throw new Error("Invalid weekly Claude allowance");
  return Math.floor(amount * 1_000_000);
}
export function weekStart(now = new Date()): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

export type Reservation = { id: string; reservedMicros: number; fx: number; model: string };
export async function reserveAiCall(userId: string, model: string, reservedMicros: number, fx: number, claude: boolean): Promise<Reservation | null> {
  if (!userId || !Number.isSafeInteger(reservedMicros) || reservedMicros < 0 || reservedMicros > 1_000_000_000 || !Number.isFinite(fx) || fx <= 0) throw new Error("Invalid AI reservation");
  const start = weekStart();
  return db.$transaction(async tx => {
    // Shared by Netlify and Railway. Serialize all reservations for this member/week.
    await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), $2::integer)::text', userId, Math.floor(start.getTime() / 86400000));
    const user = await tx.user.findUnique({ where: { id: userId }, select: { tier: true, softwareBanned: true } });
    if (!user || user.softwareBanned) throw new Error("AI member access is unavailable");
    if (claude) {
      const rows = await tx.$queryRawUnsafe<{ used: bigint }[]>(
        'SELECT COALESCE(SUM(COALESCE("chargedMicros", "reservedMicros")), 0)::bigint AS used FROM "AiUsageLedger" WHERE "userId" = $1 AND "weekStart" = $2 AND "isClaude" = true AND "state" <> \'released\'', userId, start);
      const limit = weeklyLimitMicros(user.tier);
      if (limit <= 0 || Number(rows[0]?.used ?? 0) + reservedMicros > limit) return null;
    }
    const id = randomUUID();
    await tx.$executeRawUnsafe('INSERT INTO "AiUsageLedger" ("id", "userId", "weekStart", "model", "isClaude", "reservedMicros", "fx", "state") VALUES ($1, $2, $3, $4, $5, $6, $7, \'reserved\')', id, userId, start, model, claude, reservedMicros, fx);
    return { id, reservedMicros, fx, model };
  }, { isolationLevel: "ReadCommitted", timeout: 10000, maxWait: 10000 });
}

/** Settlement precedes output validation: a paid-but-malformed response still cost money. */
export async function settleAiCall(reservation: Reservation, result: any) {
  const cost = result.usage?.cost;
  const actual = typeof cost === "number" && Number.isFinite(cost) && cost >= 0;
  const charged = actual ? Math.ceil(cost * reservation.fx * 1_000_000) : reservation.reservedMicros;
  if (!Number.isSafeInteger(charged) || charged > 2_000_000_000) throw new Error("Invalid provider usage cost");
  await db.$executeRawUnsafe('UPDATE "AiUsageLedger" SET "state" = \'settled\', "chargedMicros" = $2, "costUsd" = $3, "providerRunId" = $4, "estimated" = $5, "updatedAt" = NOW() WHERE "id" = $1 AND "state" = \'reserved\'', reservation.id, charged, actual ? cost : null, result.id ?? null, !actual);
  return charged / 1_000_000;
}

export async function failAiCall(reservation: Reservation, error: any) {
  // Timeouts/disconnects may already have incurred spend. Hold their reservation.
  const rejectedBeforeGeneration = [400, 401, 402, 403, 404, 413, 422, 429].includes(error?.status);
  await db.$executeRawUnsafe('UPDATE "AiUsageLedger" SET "state" = $2, "updatedAt" = NOW() WHERE "id" = $1 AND "state" = \'reserved\'', reservation.id, rejectedBeforeGeneration ? "released" : "uncertain");
}

export async function weeklyAiUsage(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
  if (!user) throw new Error("Member not found");
  const start = weekStart();
  const rows = await db.$queryRawUnsafe<{ used: bigint }[]>('SELECT COALESCE(SUM(COALESCE("chargedMicros", "reservedMicros")), 0)::bigint AS used FROM "AiUsageLedger" WHERE "userId" = $1 AND "weekStart" = $2 AND "isClaude" = true AND "state" <> \'released\'', userId, start);
  const limit = weeklyLimitMicros(user.tier), used = Number(rows[0]?.used ?? 0);
  return { limitGbp: limit / 1_000_000, usedGbp: used / 1_000_000, remainingGbp: Math.max(0, limit - used) / 1_000_000, resetsAt: new Date(start.getTime() + 7 * 86400000).toISOString(), fallback: used >= limit };
}
