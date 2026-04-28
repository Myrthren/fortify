import { db } from "@/lib/db";
import { sendDM } from "@/lib/discord";
import type { NotificationPrefs } from "@prisma/client";

type PrefKey = keyof Omit<NotificationPrefs, "userId">;

/**
 * Send a DM only if the user has that notification type enabled.
 * If no prefs row exists, all notifications are on by default.
 */
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
