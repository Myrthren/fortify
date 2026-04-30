import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db } from "../lib/db";
import { getOrCreateUser } from "../lib/usage";
import { TIER_LIMITS } from "../lib/tiers";

export const data = new SlashCommandBuilder()
  .setName("trends")
  .setDescription("Show your tracked trend terms.");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
  const terms = await db.watchTerm.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const limit = TIER_LIMITS[user.tier].watchTerms;
  const limitDisplay = limit === Infinity ? "unlimited" : limit;

  const embed = new EmbedBuilder()
    .setTitle("Your trend terms")
    .setColor(0xffffff)
    .setFooter({ text: `${terms.length} / ${limitDisplay} used · Manage at fortify-io.com/dashboard/trends` });

  embed.setDescription(
    terms.length === 0
      ? (user.tier === "FREE" || user.tier === "PRO"
          ? "Trend Radar is an Elite feature. Run `/upgrade` to unlock."
          : "No terms tracked yet. Add them at fortify-io.com/dashboard/trends")
      : terms.map((t) => `· ${t.term}`).join("\n")
  );

  await interaction.editReply({ embeds: [embed] });
}
