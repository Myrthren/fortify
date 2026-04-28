"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const openai_1 = require("../lib/openai");
const usage_1 = require("../lib/usage");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("hook")
    .setDescription("Generate 5 viral hooks for a topic.")
    .addStringOption((opt) => opt.setName("topic").setDescription("What's the video about?").setRequired(true));
async function execute(interaction) {
    const topic = interaction.options.getString("topic", true);
    await interaction.deferReply({ ephemeral: true });
    const user = await (0, usage_1.getOrCreateUser)(interaction.user.id, interaction.user.username);
    const ok = await (0, usage_1.canGenerate)(user.id, user.tier);
    if (!ok) {
        await interaction.editReply("You've hit your daily free limit. Run `/upgrade` to unlock unlimited generations.");
        return;
    }
    try {
        const hooks = await (0, openai_1.generateHooks)(topic, 5);
        await (0, usage_1.logGeneration)(user.id, "hook", topic, hooks.join("\n"));
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`Hooks for "${topic}"`)
            .setColor(0xffffff)
            .setDescription(hooks.map((h, i) => `**${i + 1}.** ${h}`).join("\n\n"))
            .setFooter({ text: `Fortify · ${user.tier}` });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (e) {
        console.error(e);
        await interaction.editReply("Something broke. Try again in a moment.");
    }
}
