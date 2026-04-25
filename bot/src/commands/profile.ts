import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser } from "../lib/usage";

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("Show your Fortify profile.");

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username}'s Fortify profile`)
    .setColor(0xffffff)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: "Tier", value: user.tier, inline: true },
      { name: "XP", value: user.xp.toString(), inline: true },
      { name: "Streak", value: `${user.streak} days`, inline: true }
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
