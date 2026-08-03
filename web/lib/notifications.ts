import { db } from "@/lib/db";
import { sendDM } from "@/lib/discord";
import type { NotificationPrefs } from "@prisma/client";

type PrefKey = keyof Omit<NotificationPrefs, "userId">;

const OWNER_DISCORD_ID = "731207920007643167";

export async function sendDMConditional(
  discordId: string,
  userId: string,
  prefKey: PrefKey,
  content: string
) {
  const prefs = await db.notificationPrefs.findUnique({ where: { userId } });
  if (prefs && prefs[prefKey] === false) return;
  await sendDM(discordId, content);
}

/**
 * Awards a one-time milestone and DMs the user about it.
 * No-ops if they already have it, so callers can fire on every action.
 * Returns true only when the milestone was newly awarded.
 */
export async function awardMilestone(
  userId: string,
  key: string,
  content: string
): Promise<boolean> {
  try {
    // The unique (userId, key) makes this the dedupe point even under races.
    await db.milestoneAward.create({ data: { userId, key } });
  } catch {
    return false; // already awarded
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { discordId: true },
  });
  if (user?.discordId) {
    await sendDMConditional(user.discordId, userId, "dmMilestones", content).catch(() => {});
  }
  return true;
}

export async function alertOwner(prefKey: PrefKey, content: string) {
  const owner = await db.user.findUnique({
    where: { discordId: OWNER_DISCORD_ID },
    select: { id: true },
  });
  if (!owner) return;
  await sendDMConditional(OWNER_DISCORD_ID, owner.id, prefKey, content);
}
