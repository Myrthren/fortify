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
      { name: "Pro · £29/mo", value: "Unlimited AI · brand voice · trend radar · audits", inline: false },
      { name: "Elite · £79/mo", value: "+ weekly lead pack · Recon · competitor scanner · weekly strategy report", inline: false },
      { name: "Apex · £199/mo", value: "+ monthly Growth Brief · AI Advisor · bigger lead packs · unlimited limits", inline: false }
    )
    .setURL("https://fortify-io.com/pricing")
    .setFooter({ text: "Subscribe at fortify-io.com/pricing" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
