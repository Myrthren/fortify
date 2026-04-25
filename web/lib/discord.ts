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
  const map: Record<"PRO" | "ELITE" | "APEX", string | undefined> = {
    PRO: process.env.DISCORD_ROLE_PRO,
    ELITE: process.env.DISCORD_ROLE_ELITE,
    APEX: process.env.DISCORD_ROLE_APEX,
  };

  // Revoke all paid roles the user shouldn't have, then grant the new one (if paid)
  for (const tier of ["PRO", "ELITE", "APEX"] as const) {
    if (tier !== newTier && map[tier]) {
      await revokeRole(discordUserId, map[tier]!);
    }
  }
  if (newTier !== "FREE" && map[newTier]) {
    await grantRole(discordUserId, map[newTier]!);
  }
}
