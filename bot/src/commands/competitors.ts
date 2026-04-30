import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db } from "../lib/db";
import { getOrCreateUser } from "../lib/usage";
import { TIER_LIMITS } from "../lib/tiers";

export const data = new SlashCommandBuilder()
  .setName("competitors")
  .setDescription("Show your tracked competitors.");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
  const comps = await db.competitor.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const limit = TIER_LIMITS[user.tier].competitors;
  const limitDisplay = limit === Infinity ? "unlimited" : limit;

  const embed = new EmbedBuilder()
    .setTitle("Your competitors")
    .setColor(0xffffff)
    .setFooter({ text: `${comps.length} / ${limitDisplay} used · Manage at fortify-io.com/dashboard/competitors` });

  if (comps.length === 0) {
    embed.setDescription(
      limit === 0
        ? "Competitor Scanner is a paid feature. Run `/upgrade` to unlock."
        : "No competitors tracked yet. Add them at fortify-io.com/dashboard/competitors"
    );
  } else {
    embed.setDescription(
      comps
        .map((c) => {
          const scanned = c.lastScanned
            ? `last scanned ${c.lastScanned.toISOString().slice(0, 10)}`
            : "not yet scanned";
          return `**${c.name}** — ${c.url} (${scanned})`;
        })
        .join("\n")
        .slice(0, 4000)
    );
  }

  await interaction.editReply({ embeds: [embed] });
}
