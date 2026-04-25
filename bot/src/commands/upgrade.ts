import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("upgrade")
  .setDescription("View Fortify subscription tiers.");

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("Fortify · Tiers")
    .setColor(0xffffff)
    .setDescription("Pay monthly. Cancel anytime.")
    .addFields(
      { name: "Recruit · Free", value: "10 generations/day · basic profile", inline: false },
      { name: "Soldier · $29/mo", value: "Unlimited AI · brand voice · trend radar · audits", inline: false },
      { name: "Knight · $79/mo", value: "+ competitor scanner · weekly strategy report · alerts", inline: false },
      { name: "Apex · $199/mo", value: "+ Claude Opus · custom workflows · concierge", inline: false }
    )
    .setURL("https://fortify.app/pricing")
    .setFooter({ text: "Subscribe at fortify.app/pricing" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
