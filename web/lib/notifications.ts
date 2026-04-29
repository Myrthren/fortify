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

export async function alertOwner(prefKey: PrefKey, content: string) {
  const owner = await db.user.findUnique({
    where: { discordId: OWNER_DISCORD_ID },
    select: { id: true },
  });
  if (!owner) return;
  await sendDMConditional(OWNER_DISCORD_ID, owner.id, prefKey, content);
}
