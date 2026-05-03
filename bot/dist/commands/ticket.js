"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const OWNER_ID = "731207920007643167";
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage support tickets")
    .addSubcommand((s) => s.setName("close").setDescription("Close and archive this support ticket thread"));
async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel?.isThread() || !channel.name.startsWith("ticket-")) {
        return interaction.editReply("This command can only be used inside a Fortify ticket thread.");
    }
    if (interaction.user.id !== OWNER_ID) {
        return interaction.editReply("Only the owner can close tickets.");
    }
    await channel.send("**Ticket closed.** This thread has been archived.");
    await channel.setArchived(true, "Ticket closed by owner");
    await interaction.editReply("Ticket closed and archived.");
}
