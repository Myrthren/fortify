import { db } from "@/lib/db";

// Owner's Discord user ID — DM them when abuse is flagged
const OWNER_DISCORD_ID = process.env.OWNER_DISCORD_ID ?? "";

/**
 * Flag or increment an abuse alert for a user/feature combination.
 * Sends a Discord DM to the owner at alert thresholds: 1, 5, 10, 25, 50.
 */
export async function flagAbuse(
  userId: string,
  feature: string,
  description: string
): Promise<void> {
  try {
    // Upsert: create or increment
    await db.abuseAlert.upsert({
      where: { userId_feature: { userId, feature } },
      create: { userId, feature, description, alertCount: 1, dismissed: false },
      update: {
        alertCount: { increment: 1 },
        description,
        dismissed: false,
        updatedAt: new Date(),
      },
    });

    // Fetch the current count after upsert
    const alert = await db.abuseAlert.findUnique({
      where: { userId_feature: { userId, feature } },
      select: { alertCount: true },
    });

    const count = alert?.alertCount ?? 1;
    const thresholds = [1, 5, 10, 25, 50, 100];
    if (thresholds.includes(count)) {
      await dmOwnerAbuse(userId, feature, description, count);
    }
  } catch (err) {
    // Non-critical — never crash a request over an abuse flag failure
    console.error("[abuse] flagAbuse failed:", err);
  }
}

async function dmOwnerAbuse(
  userId: string,
  feature: string,
  description: string,
  alertCount: number
): Promise<void> {
  if (!OWNER_DISCORD_ID) return;

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true, discordId: true },
    });

    const identity = user?.username
      ? `@${user.username}`
      : user?.email ?? userId;

    const message = [
      `⚠️ **Fortify Abuse Alert** (×${alertCount})`,
      `**User:** ${identity}${user?.discordId ? ` (<@${user.discordId}>)` : ""}`,
      `**Feature:** \`${feature}\``,
      `**Detail:** ${description}`,
    ].join("\n");

    // Call the bot's internal DM endpoint
    const botUrl = process.env.BOT_INTERNAL_URL;
    if (!botUrl) return;

    await fetch(`${botUrl}/dm-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": process.env.BOT_INTERNAL_KEY ?? "" },
      body: JSON.stringify({ discordId: OWNER_DISCORD_ID, message }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[abuse] dmOwnerAbuse failed:", err);
  }
}
