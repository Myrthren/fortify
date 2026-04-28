import { TIER_TO_ROLE_ID } from "@/lib/tiers";
import type { Tier } from "@prisma/client";

const DISCORD_API = "https://discord.com/api/v10";

const headers = () => ({
  Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
  "Content-Type": "application/json",
});

export async function sendDM(discordUserId: string, content: string) {
  // Open (or reuse) a DM channel
  const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!dmRes.ok) {
    console.error("Discord createDM failed:", dmRes.status, await dmRes.text());
    return;
  }
  const { id: channelId } = await dmRes.json();

  const msgRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ content }),
  });
  if (!msgRes.ok) {
    console.error("Discord sendDM failed:", msgRes.status, await msgRes.text());
  }
}

export async function grantRole(discordUserId: string, roleId: string) {
  const guildId = process.env.DISCORD_GUILD_ID!;
  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: "PUT", headers: headers() }
  );
  if (!res.ok && res.status !== 204) {
    console.error("Discord grantRole failed:", res.status, await res.text());
  }
}

export async function revokeRole(discordUserId: string, roleId: string) {
  const guildId = process.env.DISCORD_GUILD_ID!;
  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: "DELETE", headers: headers() }
  );
  if (!res.ok && res.status !== 204) {
    console.error("Discord revokeRole failed:", res.status, await res.text());
  }
}

export async function syncTierRole(discordUserId: string, newTier: Tier) {
  for (const tier of ["PRO", "ELITE", "APEX"] as const) {
    const roleId = TIER_TO_ROLE_ID[tier];
    if (tier !== newTier && roleId) {
      await revokeRole(discordUserId, roleId);
    }
  }
  const newRoleId = TIER_TO_ROLE_ID[newTier];
  if (newTier !== "FREE" && newRoleId) {
    await grantRole(discordUserId, newRoleId);
  }
}
