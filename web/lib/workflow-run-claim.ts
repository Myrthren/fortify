import { db } from "@/lib/db";
import { getCapacityInfo } from "@/lib/workflow-capacity";
import type { Tier } from "@prisma/client";

export const CAPACITY_PER_RUN = 100;
export async function claimWorkflowRun(workflowId: string, userId: string, tier: Tier, options: { idempotencyKey?: string; scheduledAt?: Date; source?: string } = {}) {
  return db.$transaction(async (tx) => {
    // The account row serialises capacity claims and credit debits for this owner.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (options.idempotencyKey) {
      const existing = await tx.workflowRun.findUnique({ where: { idempotencyKey: options.idempotencyKey } });
      if (existing) {
        if (existing.workflowId !== workflowId) throw new Error("Run identity belongs to another workflow");
        return { run: existing, existing: true, error: null };
      }
    }
    const capacity = await getCapacityInfo(userId, tier, tx);
    if (!capacity.isUnlimited && capacity.remaining < CAPACITY_PER_RUN) return { run: null, existing: false, error: "Insufficient workflow capacity" };
    const run = await tx.workflowRun.create({ data: { workflowId, status: "running", usedCapacity: CAPACITY_PER_RUN,
      idempotencyKey: options.idempotencyKey, scheduledAt: options.scheduledAt, source: options.source ?? "manual" } });
    return { run, existing: false, error: null };
  });
}
