"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("upgrade")
    .setDescription("View Fortify subscription tiers.");
async function execute(interaction) {
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle("Fortify · Tiers")
        .setColor(0xffffff)
        .setDescription("Pay monthly. Cancel anytime.")
        .addFields({ name: "Free", value: "10 generations/day · basic profile", inline: false }, { name: "Pro · $29/mo", value: "Unlimited AI · brand voice · trend radar · audits", inline: false }, { name: "Elite · $79/mo", value: "+ competitor scanner · weekly strategy report · alerts", inline: false }, { name: "Apex · $199/mo", value: "+ Claude Opus · custom workflows · concierge", inline: false })
        .setURL("https://fortify-io.com/pricing")
        .setFooter({ text: "Subscribe at fortify-io.com/pricing" });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}
