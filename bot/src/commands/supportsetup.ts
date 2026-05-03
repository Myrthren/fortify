import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelType,
  TextChannel,
} from "discord.js";

const OWNER_ID = "731207920007643167";

export const data = new SlashCommandBuilder()
  .setName("supportsetup")
  .setDescription("Post the Fortify support embed to #support — owner only, one-time");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (interaction.user.id !== OWNER_ID) {
    return interaction.editReply("Owner only.");
  }

  const guild = interaction.guild;
  if (!guild) return interaction.editReply("Must be run inside the server.");

  // Find a text channel named ❓｜support or any channel containing "support"
  const supportChannel = (
    guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === "❓｜support"
    ) ??
    guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name.toLowerCase().includes("support")
    )
  ) as TextChannel | undefined;

  if (!supportChannel) {
    return interaction.editReply(
      "No text channel with 'support' in the name found. Create one and try again."
    );
  }

  const embed = new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle("Fortify Support")
    .setDescription(
      "Need help with your subscription, a missing role, or a feature not working?\n\n" +
        "Click **Open a Ticket** below to send a private message to the team."
    )
    .addFields({
      name: "Before opening a ticket",
      value:
        "• Check your role was assigned after payment\n" +
        "• Run `/profile` to confirm your current tier\n" +
        "• Check announcements for known issues",
    })
    .setFooter({ text: "Fortify — Fortune Fortress AI co-pilot" });

  const button = new ButtonBuilder()
    .setCustomId("support_open_modal")
    .setLabel("🎫  Open a Ticket")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await supportChannel.send({ embeds: [embed], components: [row] });
  await interaction.editReply(`Support embed posted to <#${supportChannel.id}>.`);
}
