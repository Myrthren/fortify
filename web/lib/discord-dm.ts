/**
 * Send a Discord DM via the bot token (Discord REST API).
 * Works from any server-side code — no bot process needed.
 *
 * Requires: DISCORD_BOT_TOKEN in env vars.
 */

const DISCORD_API = "https://discord.com/api/v10";

async function botFetch(path: string, init: RequestInit) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

  const res = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord API ${path} → ${res.status}: ${body}`);
  }

  return res.json();
}

/** Open (or retrieve) a DM channel with the given Discord user ID */
async function openDmChannel(discordUserId: string): Promise<string> {
  const data = await botFetch("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  return data.id as string;
}

/** Send a plain message to a channel (DM or otherwise) */
export async function sendDiscordDm(
  discordUserId: string,
  content: string
): Promise<void> {
  try {
    const channelId = await openDmChannel(discordUserId);
    await botFetch(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    // User has DMs closed, has blocked the bot, or isn't in the server — swallow gracefully
    console.warn(`[discord-dm] Could not DM user ${discordUserId}:`, err);
  }
}

/** Format and send a ban notification DM */
export async function sendBanDm(opts: {
  discordUserId: string;
  banType: "PLATFORM" | "SOFTWARE";
  permanent: boolean;
  durationDays?: number | null;
  reason?: string | null;
  issuedBy: string; // Fortify username or display name of the admin
}): Promise<void> {
  const { discordUserId, banType, permanent, durationDays, reason, issuedBy } = opts;

  const typeLabel =
    banType === "SOFTWARE"
      ? "**Software Ban** — you are banned from all of Fortify"
      : "**Platform Ban** — you are banned from community features (forums, messaging, connections, job posting)";

  const durationLine = permanent
    ? "⏳ **Duration:** Permanent"
    : durationDays
    ? `⏳ **Duration:** ${durationDays} day${durationDays === 1 ? "" : "s"}`
    : "⏳ **Duration:** Temporary (duration not specified)";

  const reasonLine = reason ? `📋 **Reason:** ${reason}` : "📋 **Reason:** No reason provided";

  const message = [
    "🚫 **You have been banned from Fortify**",
    "",
    `🔒 **Ban type:** ${typeLabel}`,
    durationLine,
    reasonLine,
    `👤 **Issued by:** ${issuedBy}`,
    "",
    "If you believe this is a mistake, you can appeal using the link below:",
    "https://docs.google.com/forms/d/e/1FAIpQLScZ5aLYRS7IUgsbdXz9AZ-aEKOpfoBZQDC4aMMbpvmFXPMlUA/viewform",
  ].join("\n");

  await sendDiscordDm(discordUserId, message);
}
