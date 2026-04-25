const DISCORD_API = "https://discord.com/api/v10";

const headers = () => ({
  Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
  "Content-Type": "application/json",
});

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

export async function syncTierRole(
  discordUserId: string,
  newTier: "FREE" | "PRO" | "ELITE" | "APEX"
) {
  const map = {
    FREE: process.env.DISCORD_ROLE_RECRUIT,
    PRO: process.env.DISCORD_ROLE_SOLDIER,
    ELITE: process.env.DISCORD_ROLE_KNIGHT,
    APEX: process.env.DISCORD_ROLE_APEX,
  } as const;

  // Revoke all paid roles first, then grant the new one
  for (const tier of ["PRO", "ELITE", "APEX"] as const) {
    if (tier !== newTier && map[tier]) {
      await revokeRole(discordUserId, map[tier]!);
    }
  }
  if (map[newTier]) await grantRole(discordUserId, map[newTier]!);
}
