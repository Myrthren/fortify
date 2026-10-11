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
      { name: "Free", value: "10 generations/day · basic profile", inline: false },
      { name: "Pro · £29/mo", value: "Brand voice · competitor scanner · 5 audits/mo · included web chat allowance · 500 tool credits/mo", inline: false },
      { name: "Elite · £79/mo", value: "+ workflows · Competitor Watch · weekly strategy report · 1,500 tool credits/mo", inline: false },
      { name: "Apex · £199/mo", value: "+ AI Advisor · unlimited workflow capacity · auto-publish · 5,000 tool credits/mo", inline: false }
    )
    .setURL("https://fortify-io.com/pricing")
    .setFooter({ text: "Subscribe at fortify-io.com/pricing" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
