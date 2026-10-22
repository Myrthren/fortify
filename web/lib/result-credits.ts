import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export class InsufficientCredits extends Error {
  constructor() { super("Your credit balance changed. No credits were charged for this result."); }
}

/** Call only after validating provider output. Saving, receipt and debit either
 * all commit or all roll back. The conditional debit also protects concurrent jobs. */
export async function chargeForResult(
  userId: string, cost: number, source: string,
  save: (tx: Prisma.TransactionClient) => Promise<unknown> = async () => {},
  receiptId?: string,
): Promise<boolean> {
  if (!Number.isSafeInteger(cost) || cost < 0) throw new Error("Invalid credit cost");
  try {
    return await db.$transaction(async (tx) => {
      if (receiptId && await tx.creditTransaction.findUnique({ where: { id: receiptId } })) return false;
      if (cost > 0) {
        await tx.creditTransaction.create({ data: { ...(receiptId ? { id: receiptId } : {}), userId, amount: -cost, source } });
        const debit = await tx.user.updateMany({
          where: { id: userId, credits: { gte: cost } }, data: { credits: { decrement: cost } },
        });
        if (debit.count !== 1) throw new InsufficientCredits();
      }
      await save(tx);
      return true;
    });
  } catch (error: any) {
    // A simultaneous completion may have won the unique receipt. Its transaction
    // saved the result; this transaction (including any debit) was rolled back.
    if (receiptId && error?.code === "P2002" &&
        await db.creditTransaction.findUnique({ where: { id: receiptId } })) return false;
    throw error;
  }
}

const runKey = (userId: string, runId: string) =>
  `credit-run-${createHash("sha256").update(JSON.stringify([userId, runId])).digest("hex")}`;

/** Existing Generation storage binds asynchronous provider jobs to their owner
 * and tool. A started job is not a billable result. No schema change is needed. */
export async function registerCreditRun(userId: string, runId: string, scope: string) {
  if (!runId || typeof runId !== "string") throw new Error("Provider returned no run ID");
  await db.generation.create({ data: { id: runKey(userId, runId), userId, type: "credit-job", input: scope, output: "" } });
}

export async function readCreditRun(userId: string, runId: string, scope: string) {
  const job = await db.generation.findUnique({ where: { id: runKey(userId, runId) } });
  if (!job || job.userId !== userId || job.type !== "credit-job" || job.input !== scope) {
    throw new Error("Scan not found. Start a new scan from this account.");
  }
  return job.output ? JSON.parse(job.output) : null;
}

export async function completeCreditRun(
  userId: string, runId: string, scope: string, cost: number, source: string,
  response: Record<string, unknown>, save?: (tx: Prisma.TransactionClient) => Promise<unknown>,
) {
  const cached = await readCreditRun(userId, runId, scope);
  if (cached) return cached;
  const result = { ...response, creditsUsed: cost };
  await chargeForResult(userId, cost, source, async (tx) => {
    if (save) await save(tx);
    await tx.generation.update({ where: { id: runKey(userId, runId) }, data: { output: JSON.stringify(result) } });
  }, runKey(userId, runId));
  return readCreditRun(userId, runId, scope);
}

export const nonemptyText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
export function validReport(value: unknown, textFields: string[], arrayFields: string[] = []): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return textFields.every(k => nonemptyText(r[k])) && arrayFields.every(k => Array.isArray(r[k]));
}

export function validSourcedLeads(value: unknown, sources: { url: string }[]) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(sources.map(s => s.url));
  const seen = new Set<string>();
  return value.filter(l => {
    if (!l || !nonemptyText(l.company) || !nonemptyText(l.fitReason) || !nonemptyText(l.hook) ||
        !allowed.has(l.website) || seen.has(l.website) ||
        !Number.isFinite(l.fitScore) || l.fitScore < 1 || l.fitScore > 10) return false;
    try { if (!["https:", "http:"].includes(new URL(l.website).protocol)) return false; } catch { return false; }
    seen.add(l.website);
    return true;
  });
}
