// Owner allowlist by Discord user ID. Set OWNER_DISCORD_IDS as a
// comma-separated list of Discord IDs in the env (no spaces).
//
// Owners get access to /admin and can switch their own tier for testing.

export function ownerDiscordIds(): string[] {
  return (process.env.OWNER_DISCORD_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOwner(discordId: string | null | undefined): boolean {
  if (!discordId) return false;
  return ownerDiscordIds().includes(discordId);
}
