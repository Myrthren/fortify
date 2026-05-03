"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const OWNER_ID = "731207920007643167";
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("supportsetup")
    .setDescription("Post the Fortify support embed to #support — owner only, one-time");
async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (interaction.user.id !== OWNER_ID) {
        return interaction.editReply("Owner only.");
    }
    const guild = interaction.guild;
    if (!guild)
        return interaction.editReply("Must be run inside the server.");
    // Find a text channel named ❓｜support or any channel containing "support"
    const supportChannel = (guild.channels.cache.find((c) => c.type === discord_js_1.ChannelType.GuildText && c.name === "❓｜support") ??
        guild.channels.cache.find((c) => c.type === discord_js_1.ChannelType.GuildText && c.name.toLowerCase().includes("support")));
    if (!supportChannel) {
        return interaction.editReply("No text channel with 'support' in the name found. Create one and try again.");
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0xffffff)
        .setTitle("Fortify Support")
        .setDescription("Need help with your subscription, a missing role, or a feature not working?\n\n" +
        "Click **Open a Ticket** below to send a private message to the team.")
        .addFields({
        name: "Before opening a ticket",
        value: "• Check your role was assigned after payment\n" +
            "• Run `/profile` to confirm your current tier\n" +
            "• Check announcements for known issues",
    })
        .setFooter({ text: "Fortify — Fortune Fortress AI co-pilot" });
    const button = new discord_js_1.ButtonBuilder()
        .setCustomId("support_open_modal")
        .setLabel("🎫  Open a Ticket")
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const row = new discord_js_1.ActionRowBuilder().addComponents(button);
    await supportChannel.send({ embeds: [embed], components: [row] });
    await interaction.editReply(`Support embed posted to <#${supportChannel.id}>.`);
}
