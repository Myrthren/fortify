import type { Prisma } from "@prisma/client";
import { missionMilestonesForStage } from "./growth-mission";

/** Keep observed mission milestones even when a pipeline lead later changes stage. */
export async function stampMissionOutcomes(tx: Prisma.TransactionClient, userId: string, leadId: string, status: string) {
  const where = { leadId, decision: "approved", mission: { userId } };
  const now = new Date();
  const milestones = missionMilestonesForStage(status);
  if (milestones.replied) await tx.growthMissionLead.updateMany({ where: { ...where, repliedAt: null }, data: { repliedAt: now } });
  if (milestones.booked) await tx.growthMissionLead.updateMany({ where: { ...where, bookedAt: null }, data: { bookedAt: now } });
  if (milestones.won) await tx.growthMissionLead.updateMany({ where: { ...where, wonAt: null }, data: { wonAt: now } });
}
