"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const db_1 = require("../lib/db");
const usage_1 = require("../lib/usage");
const tiers_1 = require("../lib/tiers");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("voice")
    .setDescription("Show your trained brand voices.");
async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const user = await (0, usage_1.getOrCreateUser)(interaction.user.id, interaction.user.username);
    const voices = await db_1.db.brandVoice.findMany({
        where: { userId: user.id },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        select: { id: true, name: true, isActive: true, createdAt: true },
    });
    const limit = tiers_1.TIER_LIMITS[user.tier].brandVoices;
    const limitDisplay = limit === Infinity ? "unlimited" : limit;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle("Your brand voices")
        .setColor(0xffffff)
        .setFooter({ text: `${voices.length} / ${limitDisplay} used · Manage at fortify-io.com/dashboard/voice` });
    if (voices.length === 0) {
        embed.setDescription(user.tier === "FREE"
            ? "Brand Voice is a Pro feature. Run `/upgrade` to unlock."
            : "No voices yet. Train your first at fortify-io.com/dashboard/voice");
    }
    else {
        embed.setDescription(voices
            .map((v) => `${v.isActive ? "🟢" : "⚪"} **${v.name}** — trained ${v.createdAt.toISOString().slice(0, 10)}`)
            .join("\n"));
    }
    await interaction.editReply({ embeds: [embed] });
}
