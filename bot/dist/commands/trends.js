"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const db_1 = require("../lib/db");
const usage_1 = require("../lib/usage");
const tiers_1 = require("../lib/tiers");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("trends")
    .setDescription("Show your tracked trend terms.");
async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const user = await (0, usage_1.getOrCreateUser)(interaction.user.id, interaction.user.username);
    const terms = await db_1.db.watchTerm.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
    });
    const limit = tiers_1.TIER_LIMITS[user.tier].watchTerms;
    const limitDisplay = limit === Infinity ? "unlimited" : limit;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle("Your trend terms")
        .setColor(0xffffff)
        .setFooter({ text: `${terms.length} / ${limitDisplay} used · Manage at fortify-io.com/dashboard/trends` });
    embed.setDescription(terms.length === 0
        ? (user.tier === "FREE" || user.tier === "PRO"
            ? "Trend Radar is an Elite feature. Run `/upgrade` to unlock."
            : "No terms tracked yet. Add them at fortify-io.com/dashboard/trends")
        : terms.map((t) => `· ${t.term}`).join("\n"));
    await interaction.editReply({ embeds: [embed] });
}
