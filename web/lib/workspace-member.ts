import type { Tier } from "@prisma/client";
export type WorkspaceMember = { email: string | null; username?: string | null; tier: Tier; discordId: string | null; credits?: number };
export function workspaceMember(user: WorkspaceMember): WorkspaceMember {
  return { email: user.email, username: user.username, tier: user.tier, discordId: user.discordId, credits: user.credits };
}
