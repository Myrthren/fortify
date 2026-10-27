export const WORKSPACE_TUTORIAL_VERSION = 1;
export const WORKSPACE_TUTORIAL_LAST_STEP = 4;
export type WorkspaceTutorialState = { version: number; step: number; outcome: string };
export type WorkspaceTutorialStatus = { canReplay: boolean; autoStart: boolean; tier: string; state: WorkspaceTutorialState | null };

// Called only inside the verified first-subscription transaction. Retries,
// renewals, provider changes and upgrades never reset a member's decision.
export async function enrollWorkspaceTutorial(tx: Pick<Prisma.TransactionClient, "workspaceTutorialProgress">, userId: string) {
  await tx.workspaceTutorialProgress.upsert({ where: { userId }, create: { userId }, update: {} });
}

export function tutorialState(existing: WorkspaceTutorialState | null, action: string, step: number) {
  return {
    version: WORKSPACE_TUTORIAL_VERSION,
    step: Math.max(existing?.step ?? 0, step),
    outcome: existing?.outcome === "completed" || action === "complete" ? "completed" : action === "skip" ? "skipped" : existing?.outcome ?? "skipped",
  };
}
import type { Prisma } from "@prisma/client";

