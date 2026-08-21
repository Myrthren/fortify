"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const client_1 = require("@prisma/client");
const db_1 = require("../lib/db");
const drip_1 = require("../lib/drip");
const CAMPAIGNS = [
    { name: "Welcome (new members)", value: "WELCOME" },
    { name: "Activation (existing members)", value: "ACTIVATION" },
];
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("drip")
    .setDescription("Owner: manage the Discord DM drip campaigns.")
    .addSubcommand((s) => s.setName("status").setDescription("Queue depth, campaign state and this week's counters."))
    .addSubcommand((s) => s
    .setName("rollout")
    .setDescription("Seed every member without an active plan into the activation campaign.")
    .addBooleanOption((o) => o.setName("confirm").setDescription("Required. Bulk DMs carry real account risk.").setRequired(true)))
    .addSubcommand((s) => s
    .setName("pause")
    .setDescription("Stop a campaign sending.")
    .addStringOption((o) => o.setName("campaign").setDescription("Which campaign").setRequired(true).addChoices(...CAMPAIGNS)))
    .addSubcommand((s) => s
    .setName("resume")
    .setDescription("Let a campaign send again (also clears the circuit breaker).")
    .addStringOption((o) => o.setName("campaign").setDescription("Which campaign").setRequired(true).addChoices(...CAMPAIGNS)))
    .addSubcommand((s) => s
    .setName("sweep")
    .setDescription("Run one sweep immediately instead of waiting for the schedule.")
    .addStringOption((o) => o.setName("campaign").setDescription("Which campaign").setRequired(true).addChoices(...CAMPAIGNS)))
    .addSubcommand((s) => s
    .setName("preview")
    .setDescription("DM yourself one stage without touching anyone's queue.")
    .addStringOption((o) => o.setName("campaign").setDescription("Which campaign").setRequired(true).addChoices(...CAMPAIGNS))
    .addIntegerOption((o) => o.setName("stage").setDescription("1 = opener + quiz, 2 = upgrade nudge").setRequired(true).setMinValue(1).setMaxValue(2)))
    .addSubcommand((s) => s
    .setName("stop")
    .setDescription("Opt one person out permanently.")
    .addUserOption((o) => o.setName("user").setDescription("Who to stop messaging").setRequired(true)));
async function execute(interaction) {
    if (interaction.user.id !== drip_1.OWNER_ID) {
        return interaction.reply({ content: "Owner only.", ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const campaign = (interaction.options.getString("campaign") ?? "WELCOME");
    if (sub === "status") {
        const [welcome, activation] = await Promise.all([(0, drip_1.getState)("WELCOME"), (0, drip_1.getState)("ACTIVATION")]);
        const counts = await db_1.db.dripEnrollment.groupBy({
            by: ["campaign", "status"],
            _count: { _all: true },
        });
        const optOuts = await db_1.db.dripOptOut.count();
        const m = await (0, drip_1.metricsFor)((0, drip_1.weekStart)());
        const n = (k) => m[k] ?? 0;
        const queueLine = (c) => {
            const rows = counts.filter((r) => r.campaign === c);
            const get = (s) => rows.find((r) => r.status === s)?._count._all ?? 0;
            return `pending ${get(client_1.DripStatus.PENDING)} · done ${get(client_1.DripStatus.DONE)} · stopped ${get(client_1.DripStatus.STOPPED)}`;
        };
        const stateLine = (s) => `${s.paused ? "PAUSED" : "running"}${s.pausedReason ? ` — ${s.pausedReason}` : ""} · consecutive failures ${s.consecutiveFailures}`;
        return interaction.editReply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(0xffffff)
                    .setTitle("Drip status")
                    .addFields({ name: "Welcome", value: `${stateLine(welcome)}\n${queueLine(client_1.DripCampaign.WELCOME)}` }, { name: "Activation", value: `${stateLine(activation)}\n${queueLine(client_1.DripCampaign.ACTIVATION)}` }, {
                    name: "This week",
                    value: `welcomes ${n("welcome_sent")} · activation ${n("activation_sent")} · nudges ${n("upgrade_nudge_sent")}\n` +
                        `quiz ${n("quiz_started")} started / ${n("quiz_completed")} finished\n` +
                        `dm closed ${n("dm_closed")} (expected) · real failures ${n("dm_failed_other")}`,
                }, { name: "Opted out", value: `${optOuts} all-time`, inline: true }, {
                    name: "Rolled out",
                    value: activation.rolledOutAt ? `<t:${Math.floor(activation.rolledOutAt.getTime() / 1000)}:R>` : "never",
                    inline: true,
                })
                    .setFooter({ text: "Sweeps at :11 and :27 UTC" }),
            ],
        });
    }
    if (sub === "rollout") {
        if (!interaction.options.getBoolean("confirm", true)) {
            return interaction.editReply("Cancelled — pass `confirm: true` to seed the queue.");
        }
        if (!interaction.guild)
            return interaction.editReply("Run this in the server.");
        const { seeded, skipped, scanned } = await (0, drip_1.rollout)(interaction.guild);
        const state = await (0, drip_1.getState)("ACTIVATION");
        return interaction.editReply(`Seeded **${seeded}** of ${scanned} members (${skipped} skipped: subscribed, opted out, or already in a campaign).\n` +
            (state.paused
                ? "Activation is **paused**, so nothing sends yet. `/drip resume campaign:ACTIVATION` when you are ready — 3 DMs an hour from then on."
                : "Activation is running — 3 DMs an hour from the next :27."));
    }
    if (sub === "pause") {
        await (0, drip_1.setPaused)(campaign, true, "paused by owner");
        return interaction.editReply(`${campaign} paused. Nothing sends until you resume.`);
    }
    if (sub === "resume") {
        await (0, drip_1.setPaused)(campaign, false);
        return interaction.editReply(`${campaign} resumed and the failure counter is cleared.`);
    }
    if (sub === "sweep") {
        const sent = await (0, drip_1.sweep)(interaction.client, campaign);
        return interaction.editReply(`${campaign} sweep sent ${sent} message(s). Cap per sweep still applies.`);
    }
    if (sub === "preview") {
        const stage = interaction.options.getInteger("stage", true);
        const result = await (0, drip_1.sendStage)(interaction.client, drip_1.OWNER_ID, campaign, stage, false);
        return interaction.editReply(result === "sent" ? `Sent ${campaign} stage ${stage} to your DMs. Nobody's queue was touched.` : `Could not DM you: ${result}.`);
    }
    if (sub === "stop") {
        const user = interaction.options.getUser("user", true);
        await (0, drip_1.optOut)(user.id, "owner");
        return interaction.editReply(`${user.tag} is opted out permanently and their pending stages are stopped.`);
    }
}
