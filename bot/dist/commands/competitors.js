"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const db_1 = require("../lib/db");
const usage_1 = require("../lib/usage");
const tiers_1 = require("../lib/tiers");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("competitors")
    .setDescription("Show your tracked competitors.");
async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const user = await (0, usage_1.getOrCreateUser)(interaction.user.id, interaction.user.username);
    const comps = await db_1.db.competitor.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
    });
    const limit = tiers_1.TIER_LIMITS[user.tier].competitors;
    const limitDisplay = limit === Infinity ? "unlimited" : limit;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle("Your competitors")
        .setColor(0xffffff)
        .setFooter({ text: `${comps.length} / ${limitDisplay} used · Manage at fortify-io.com/dashboard/competitors` });
    if (comps.length === 0) {
        embed.setDescription(limit === 0
            ? "Competitor Scanner is a paid feature. Run `/upgrade` to unlock."
            : "No competitors tracked yet. Add them at fortify-io.com/dashboard/competitors");
    }
    else {
        embed.setDescription(comps
            .map((c) => {
            const scanned = c.lastScanned
                ? `last scanned ${c.lastScanned.toISOString().slice(0, 10)}`
                : "not yet scanned";
            return `**${c.name}** — ${c.url} (${scanned})`;
        })
            .join("\n")
            .slice(0, 4000));
    }
    await interaction.editReply({ embeds: [embed] });
}
