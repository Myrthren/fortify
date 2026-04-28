"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const usage_1 = require("../lib/usage");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show your Fortify profile.");
async function execute(interaction) {
    const user = await (0, usage_1.getOrCreateUser)(interaction.user.id, interaction.user.username);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`${interaction.user.username}'s Fortify profile`)
        .setColor(0xffffff)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields({ name: "Tier", value: user.tier, inline: true }, { name: "XP", value: user.xp.toString(), inline: true }, { name: "Streak", value: `${user.streak} days`, inline: true });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}
