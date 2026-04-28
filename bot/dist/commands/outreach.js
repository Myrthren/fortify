"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const db_1 = require("../lib/db");
const usage_1 = require("../lib/usage");
const tiers_1 = require("../lib/tiers");
const outreach_1 = require("../lib/outreach");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("outreach")
    .setDescription("Generate cold outreach for a prospect.")
    .addStringOption((o) => o.setName("channel").setDescription("Where you'll send it").setRequired(true).addChoices({ name: "Twitter DM", value: "dm" }, { name: "LinkedIn", value: "linkedin" }, { name: "Email", value: "email" }, { name: "Cold sales email", value: "cold-email" }))
    .addStringOption((o) => o
    .setName("prospect")
    .setDescription("Who they are — bio, role, recent post (min 20 chars)")
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(500))
    .addStringOption((o) => o
    .setName("offer")
    .setDescription("What you want / are offering (min 10 chars)")
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500));
async function execute(interaction) {
    const channel = interaction.options.getString("channel", true);
    const prospect = interaction.options.getString("prospect", true);
    const offer = interaction.options.getString("offer", true);
    if (!outreach_1.OUTREACH_CHANNELS.includes(channel)) {
        await interaction.reply({ content: "Invalid channel.", ephemeral: true });
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    const user = await (0, usage_1.getOrCreateUser)(interaction.user.id, interaction.user.username);
    const limit = tiers_1.TIER_LIMITS[user.tier].monthlyOutreach;
    const { ok, used } = await (0, usage_1.checkMonthly)(user.id, "outreach", limit);
    if (!ok) {
        await interaction.editReply(limit === 0
            ? "Cold Outreach is a paid feature. Run `/upgrade` to unlock."
            : `You've used ${used}/${limit} outreach messages this month. Upgrade for more.`);
        return;
    }
    const activeVoice = await db_1.db.brandVoice.findFirst({
        where: { userId: user.id, isActive: true },
        select: { systemPrompt: true, name: true },
    });
    try {
        const message = await (0, outreach_1.generateOutreach)({
            prospect,
            offer,
            channel,
            voiceSystemPrompt: activeVoice?.systemPrompt,
        });
        await (0, usage_1.logGeneration)(user.id, "outreach", JSON.stringify({ channel, prospect, offer }), message);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`Outreach — ${channel}`)
            .setColor(0xffffff)
            .setDescription("```\n" + message.slice(0, 3800) + "\n```")
            .setFooter({
            text: activeVoice
                ? `In voice: ${activeVoice.name} · Fortify`
                : `Fortify · set an active voice at fortify-io.com/dashboard/voice`,
        });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (e) {
        console.error("[/outreach]", e);
        await interaction.editReply(`Generation failed: ${e.message}`);
    }
}
