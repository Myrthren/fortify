"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OWNER_ID = void 0;
exports.weekStart = weekStart;
exports.bump = bump;
exports.metricsFor = metricsFor;
exports.getState = getState;
exports.setPaused = setPaused;
exports.stageCount = stageCount;
exports.sendStage = sendStage;
exports.handleJoin = handleJoin;
exports.rollout = rollout;
exports.sweep = sweep;
exports.optOut = optOut;
exports.weeklyReport = weeklyReport;
const discord_js_1 = require("discord.js");
const client_1 = require("@prisma/client");
const db_1 = require("./db");
const tiers_1 = require("./tiers");
const drip_quiz_1 = require("./drip-quiz");
/**
 * Drip DM campaigns.
 *
 * Two campaigns share one queue table and one sweeper. They are separate rows
 * with separate schedules, but unlike the original build they do know about
 * each other: nobody is seeded into ACTIVATION while a WELCOME enrolment is
 * still pending, so the same person is never double-messaged.
 *
 * WELCOME    — fires on the join event, one person, automatic.
 * ACTIVATION — owner-triggered, everyone without an active plan, paced.
 */
exports.OWNER_ID = "731207920007643167";
/** Discord's "cannot send messages to this user" — DMs closed or bot blocked. */
const DM_CLOSED = 50007;
/** Consecutive non-50007 failures before a campaign pauses itself. */
const BREAKER_THRESHOLD = 5;
/**
 * Per-sweep send cap. This is the entire rate limiter; there is no other
 * throttle in the system. WELCOME only ever carries follow-ups for people who
 * already joined, so it can run wider than the bulk campaign.
 */
const SEND_CAP = {
    WELCOME: 20,
    ACTIVATION: 3,
};
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
/** Gap between stages, measured per person — never from a shared clock. */
const STAGE_GAP_MS = 24 * HOUR;
/** Perfectly regular send intervals are a bot signature; irregular ones are not. */
const JITTER_MS = 25 * MINUTE;
function jittered(base) {
    return new Date(base + Math.floor(Math.random() * JITTER_MS));
}
// ── Metrics ─────────────────────────────────────────────────────────────────
// Counters are keyed by ISO week rather than reset in place, so a weekly report
// that fails to send cannot destroy the data it was reporting on. Increments go
// through Prisma's atomic `increment`, so simultaneous bumps cannot lose one.
function weekStart(d = new Date()) {
    const s = new Date(d);
    s.setUTCHours(0, 0, 0, 0);
    const dow = (s.getUTCDay() + 6) % 7; // Monday = 0
    s.setUTCDate(s.getUTCDate() - dow);
    return s;
}
async function bump(key, by = 1) {
    const periodStart = weekStart();
    await db_1.db.dripMetric
        .upsert({
        where: { periodStart_key: { periodStart, key } },
        create: { periodStart, key, count: by },
        update: { count: { increment: by } },
    })
        .catch((e) => console.error("[drip] metric bump failed:", key, e));
}
async function metricsFor(periodStart) {
    const rows = await db_1.db.dripMetric.findMany({ where: { periodStart } });
    return Object.fromEntries(rows.map((r) => [r.key, r.count]));
}
// ── Campaign state ──────────────────────────────────────────────────────────
async function getState(campaign) {
    return db_1.db.dripCampaignState.upsert({
        where: { campaign },
        create: { campaign, paused: campaign === "ACTIVATION" },
        update: {},
    });
}
async function setPaused(campaign, paused, reason) {
    await getState(campaign);
    return db_1.db.dripCampaignState.update({
        where: { campaign },
        data: { paused, pausedReason: paused ? reason ?? null : null, consecutiveFailures: 0 },
    });
}
// ── Eligibility ─────────────────────────────────────────────────────────────
async function hasActivePlan(discordId) {
    const user = await db_1.db.user.findUnique({
        where: { discordId },
        select: { subscription: { select: { status: true } } },
    });
    return user?.subscription?.status === "ACTIVE";
}
async function isOptedOut(discordId) {
    return (await db_1.db.dripOptOut.findUnique({ where: { discordId } })) !== null;
}
/**
 * Re-checked on every sweep, not just at seed time, so anyone who subscribed or
 * left since being queued is dropped rather than told to get set up a week
 * after paying. Subscribers are handed off to the web onboarding drip
 * (web/app/api/cron/onboarding) which owns messaging for paying members.
 */
async function stillEligible(guild, discordId) {
    if (await isOptedOut(discordId))
        return { ok: false, reason: "opted_out" };
    if (await hasActivePlan(discordId))
        return { ok: false, reason: "skipped_subscribed" };
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member)
        return { ok: false, reason: "skipped_left_server" };
    return { ok: true };
}
// ── Message content ─────────────────────────────────────────────────────────
function stopButton() {
    return new discord_js_1.ButtonBuilder()
        .setCustomId("drip_stop")
        .setLabel("Stop these messages")
        .setStyle(discord_js_1.ButtonStyle.Secondary);
}
function linkRow() {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setLabel("Open dashboard").setStyle(discord_js_1.ButtonStyle.Link).setURL("https://fortify-io.com/dashboard"), new discord_js_1.ButtonBuilder().setLabel("See tiers").setStyle(discord_js_1.ButtonStyle.Link).setURL("https://fortify-io.com/pricing"));
}
function welcomeOpener() {
    return {
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(0xffffff)
                .setTitle("Welcome to Fortify")
                .setDescription("Fortify is the AI operating system for creators and operators — hooks, funnel audits, competitor scans, trend radar and lead sourcing, all in one dashboard.\n\n" +
                "The free tier is ten generations a day with no card: **fortify-io.com/dashboard**\n\n" +
                "You can also work the bot directly in the server — `/hook`, `/audit`, `/trends`, `/matchmake` — or just @mention it with a question.")
                .setFooter({ text: "Fortify" }),
        ],
        components: [new discord_js_1.ActionRowBuilder().addComponents(stopButton())],
    };
}
function activationOpener() {
    return {
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(0xffffff)
                .setTitle("Your Fortify dashboard is still empty")
                .setDescription("You are in the server but you have never run anything. That is usually a not-knowing-where-to-start problem rather than a not-interested one.\n\n" +
                "Four questions below and I will tell you exactly which three tools to open first. Free tier, no card, ten generations a day.")
                .setFooter({ text: "Fortify · fortify-io.com/dashboard" }),
        ],
        components: [new discord_js_1.ActionRowBuilder().addComponents(stopButton())],
    };
}
function upgradeNudge() {
    return {
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(0xffffff)
                .setTitle("The part most people miss")
                .setDescription("Free covers ten generations a day, which is enough to prove the tools work and not enough to run on.\n\n" +
                "**Pro — $29/mo** · unlimited generations, Brand Voice (trains on your own writing so every output sounds like you), five funnel audits a month, trend radar.\n" +
                "**Elite — $79/mo** · adds the competitor scanner, unlimited audits and weekly strategy reports.\n" +
                "**Apex — $199/mo** · adds Claude Opus, custom workflows and auto-publish.\n\n" +
                "Monthly, cancel anytime.")
                .setFooter({ text: "Fortify · fortify-io.com/pricing" }),
        ],
        components: [linkRow(), new discord_js_1.ActionRowBuilder().addComponents(stopButton())],
    };
}
/**
 * Stage 1 of each campaign is an opener plus the quiz as a separate DM; stage 2
 * is the upgrade nudge 24 hours later. `quiz: true` means the sender follows the
 * opener with its own send, in its own try/catch.
 */
const STAGES = {
    WELCOME: [
        { metric: "welcome_sent", quiz: true, build: welcomeOpener },
        { metric: "upgrade_nudge_sent", quiz: false, build: upgradeNudge },
    ],
    ACTIVATION: [
        { metric: "activation_sent", quiz: true, build: activationOpener },
        { metric: "upgrade_nudge_sent", quiz: false, build: upgradeNudge },
    ],
};
function stageCount(campaign) {
    return STAGES[campaign].length;
}
/**
 * Error 50007 means DMs are closed or the bot is blocked. On any real campaign
 * that is a large minority of attempts and it means nothing is wrong, so it is
 * counted apart from real failures — otherwise the one number that would warn
 * you something is broken gets buried under normal noise.
 */
async function sendStage(client, discordId, campaign, stage, count = true // false for owner previews, which must not move the counters
) {
    const def = STAGES[campaign][stage - 1];
    if (!def)
        return "sent";
    try {
        const user = await client.users.fetch(discordId);
        await user.send(def.build());
        if (count)
            await bump(def.metric);
        if (def.quiz) {
            // Its own try/catch: if the quiz fails the opener still counts as
            // delivered rather than the whole send unwinding.
            try {
                await user.send((0, drip_quiz_1.quizOpener)());
                if (count)
                    await bump("quiz_offered");
            }
            catch (e) {
                console.warn(`[drip] quiz send failed for ${discordId}:`, e?.code ?? e);
            }
        }
        return "sent";
    }
    catch (e) {
        if (e?.code === DM_CLOSED) {
            if (count)
                await bump("dm_closed");
            return "closed";
        }
        if (count)
            await bump("dm_failed_other");
        console.error(`[drip] send failed for ${discordId} (${campaign} stage ${stage}):`, e?.code ?? e);
        return "failed";
    }
}
/**
 * Consecutive non-50007 failures trip the breaker. Without one, a flagged bot
 * account burns through the whole queue before anyone notices.
 */
async function recordOutcome(client, campaign, result) {
    if (result !== "failed") {
        await db_1.db.dripCampaignState.update({ where: { campaign }, data: { consecutiveFailures: 0 } }).catch(() => { });
        return;
    }
    const state = await db_1.db.dripCampaignState.update({
        where: { campaign },
        data: { consecutiveFailures: { increment: 1 } },
    });
    if (state.consecutiveFailures >= BREAKER_THRESHOLD && !state.paused) {
        await setPaused(campaign, true, `circuit breaker: ${state.consecutiveFailures} consecutive send failures`);
        await bump("breaker_tripped");
        await client.users
            .fetch(exports.OWNER_ID)
            .then((o) => o.send(`**Drip paused automatically** — ${campaign} hit ${state.consecutiveFailures} consecutive send failures that were not 50007. ` +
            `Check the bot logs, then \`/drip resume campaign:${campaign}\`.`))
            .catch(() => { });
    }
}
// ── Enrolment ───────────────────────────────────────────────────────────────
/** Idempotent: an existing enrolment is left exactly as it is. */
async function enroll(discordId, campaign, stage, dueAt) {
    return db_1.db.dripEnrollment.upsert({
        where: { discordId_campaign: { discordId, campaign } },
        create: { discordId, campaign, stage, dueAt },
        update: {},
    });
}
/** True when this person is mid-flight in some other campaign. */
async function inAnotherCampaign(discordId, campaign) {
    const other = await db_1.db.dripEnrollment.findFirst({
        where: { discordId, status: client_1.DripStatus.PENDING, NOT: { campaign } },
        select: { id: true },
    });
    return other !== null;
}
// ── Flow one: new member ────────────────────────────────────────────────────
/**
 * Join handler. The order of operations is doing real work here: the delayed
 * message is queued before anything is sent, because the sends below are
 * allowed to throw on closed DMs and a swallowed throw must not cost the
 * enrolment. In any handler that both persists and sends, persist first.
 */
async function handleJoin(member) {
    const discordId = member.id;
    if (member.user.bot || discordId === exports.OWNER_ID)
        return;
    await bump("joined");
    if (await isOptedOut(discordId))
        return;
    // 1. Someone can pay before joining — checkout lives outside Discord, so the
    //    join handler is the second chance to catch that.
    const user = await db_1.db.user.findUnique({
        where: { discordId },
        select: { tier: true, subscription: { select: { status: true } } },
    });
    // 2. Active plan: grant the role, confirm, and stop. Never pitch a product to
    //    someone who already bought it. Their onboarding is the web drip's job.
    if (user?.subscription?.status === "ACTIVE") {
        const roleId = tiers_1.TIER_TO_ROLE_ID[user.tier];
        if (roleId)
            await member.roles.add(roleId).catch((e) => console.error("[drip] role grant failed:", e));
        await bump("joined_subscribed");
        await member
            .send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(0xffffff)
                    .setTitle(`Welcome back — ${tiers_1.TIER_NAMES[user.tier]} is active`)
                    .setDescription("Your role is applied and every tier-gated channel and tool is unlocked.\n\nPick up where you left off: **fortify-io.com/dashboard**")
                    .setFooter({ text: "Fortify" }),
            ],
            components: [linkRow()],
        })
            .catch((e) => {
            if (e?.code === DM_CLOSED)
                bump("dm_closed");
        });
        return;
    }
    // 3. Queue the delayed message before any sending at all. A rejoin finds its
    //    old enrolment and stops here rather than welcoming the same person twice.
    const existing = await db_1.db.dripEnrollment.findUnique({
        where: { discordId_campaign: { discordId, campaign: client_1.DripCampaign.WELCOME } },
        select: { id: true },
    });
    if (existing) {
        await bump("rejoin_skipped");
        return;
    }
    await enroll(discordId, "WELCOME", 2, jittered(Date.now() + STAGE_GAP_MS));
    // 4 & 5. Opener, then quiz in its own try/catch (inside sendStage).
    const result = await sendStage(member.client, discordId, "WELCOME", 1);
    if (result === "closed") {
        await db_1.db.dripEnrollment.update({
            where: { discordId_campaign: { discordId, campaign: client_1.DripCampaign.WELCOME } },
            data: { status: client_1.DripStatus.STOPPED, lastError: "dm_closed" },
        });
    }
    else {
        await db_1.db.dripEnrollment.update({
            where: { discordId_campaign: { discordId, campaign: client_1.DripCampaign.WELCOME } },
            data: { sentCount: { increment: 1 } },
        });
    }
    await recordOutcome(member.client, "WELCOME", result);
}
// ── Flow two: existing members ──────────────────────────────────────────────
/**
 * Seeds everyone without an active plan. Seeding and sending are separate on
 * purpose: queueing is instant, delivery is what gets rationed. Existing
 * enrolments are untouched, so re-running tops up with new members instead of
 * restarting anyone.
 */
async function rollout(guild) {
    const members = await guild.members.fetch();
    let seeded = 0;
    let skipped = 0;
    for (const member of members.values()) {
        if (member.user.bot || member.id === exports.OWNER_ID)
            continue;
        const check = await stillEligible(guild, member.id);
        if (!check.ok) {
            skipped++;
            continue;
        }
        if (await inAnotherCampaign(member.id, client_1.DripCampaign.ACTIVATION)) {
            skipped++;
            continue;
        }
        await enroll(member.id, "ACTIVATION", 1, new Date());
        seeded++;
    }
    await getState("ACTIVATION");
    await db_1.db.dripCampaignState.update({
        where: { campaign: client_1.DripCampaign.ACTIVATION },
        data: { rolledOutAt: new Date() },
    });
    return { seeded, skipped, scanned: members.size };
}
// ── The sweep ───────────────────────────────────────────────────────────────
async function sweep(client, campaign) {
    const state = await getState(campaign);
    if (state.paused)
        return 0;
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID ?? "") ?? client.guilds.cache.first();
    if (!guild)
        return 0;
    const due = await db_1.db.dripEnrollment.findMany({
        where: { campaign, status: client_1.DripStatus.PENDING, dueAt: { lte: new Date() } },
        orderBy: { dueAt: "asc" },
        take: SEND_CAP[campaign],
    });
    let sent = 0;
    for (const row of due) {
        const check = await stillEligible(guild, row.discordId);
        if (!check.ok) {
            await db_1.db.dripEnrollment.update({
                where: { id: row.id },
                data: { status: client_1.DripStatus.STOPPED, lastError: check.reason },
            });
            if (check.reason)
                await bump(check.reason);
            continue;
        }
        const result = await sendStage(client, row.discordId, campaign, row.stage);
        await recordOutcome(client, campaign, result);
        if (result === "sent")
            sent++;
        // A closed DM is terminal — retrying it every sweep forever achieves
        // nothing. Every other outcome advances the stage regardless, so one failed
        // send cannot pin someone to the front of the queue.
        if (result === "closed") {
            await db_1.db.dripEnrollment.update({
                where: { id: row.id },
                data: { status: client_1.DripStatus.STOPPED, lastError: "dm_closed" },
            });
            continue;
        }
        const nextStage = row.stage + 1;
        const done = nextStage > stageCount(campaign);
        await db_1.db.dripEnrollment.update({
            where: { id: row.id },
            data: {
                stage: nextStage,
                status: done ? client_1.DripStatus.DONE : client_1.DripStatus.PENDING,
                dueAt: jittered(Date.now() + STAGE_GAP_MS),
                sentCount: { increment: result === "sent" ? 1 : 0 },
                lastError: result === "failed" ? "send_failed" : null,
            },
        });
    }
    if (sent > 0)
        console.log(`[drip] ${campaign} sweep sent ${sent}/${due.length}`);
    return sent;
}
// ── Opt-out ─────────────────────────────────────────────────────────────────
/** One click, recorded permanently, never messaged again. */
async function optOut(discordId, source = "button") {
    await db_1.db.dripOptOut.upsert({ where: { discordId }, create: { discordId, source }, update: {} });
    await db_1.db.dripEnrollment.updateMany({
        where: { discordId, status: client_1.DripStatus.PENDING },
        data: { status: client_1.DripStatus.STOPPED, lastError: "opted_out" },
    });
    await bump("opted_out");
}
// ── Weekly report ───────────────────────────────────────────────────────────
/**
 * Reports on the week that just closed. The delivered marker is written only
 * after the DM succeeds, so a transient failure retries on the next tick
 * instead of silently skipping a week.
 */
async function weeklyReport(client) {
    const period = weekStart(new Date(Date.now() - 7 * 24 * HOUR));
    const m = await metricsFor(period);
    if (m["report_delivered"])
        return false;
    if (Object.keys(m).length === 0)
        return false;
    const pending = await db_1.db.dripEnrollment.groupBy({
        by: ["campaign"],
        where: { status: client_1.DripStatus.PENDING },
        _count: { _all: true },
    });
    const n = (k) => m[k] ?? 0;
    const attempted = n("welcome_sent") + n("activation_sent") + n("upgrade_nudge_sent") + n("dm_closed") + n("dm_failed_other");
    const closedPct = attempted ? Math.round((n("dm_closed") / attempted) * 100) : 0;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0xffffff)
        .setTitle("Drip — week of " + period.toISOString().slice(0, 10))
        .setDescription("All times UTC. Servers run UTC, so the schedule is pinned to it rather than local time.")
        .addFields({ name: "Joined", value: `${n("joined")} (${n("joined_subscribed")} already subscribed)`, inline: true }, { name: "Welcomes", value: `${n("welcome_sent")}`, inline: true }, { name: "Activation", value: `${n("activation_sent")}`, inline: true }, { name: "Upgrade nudges", value: `${n("upgrade_nudge_sent")}`, inline: true }, { name: "Quiz started / finished", value: `${n("quiz_started")} / ${n("quiz_completed")}`, inline: true }, { name: "Opted out", value: `${n("opted_out")}`, inline: true }, { name: "DMs closed", value: `${n("dm_closed")} (${closedPct}% of attempts — expected)`, inline: true }, { name: "Real failures", value: `${n("dm_failed_other")}${n("breaker_tripped") ? " · breaker tripped" : ""}`, inline: true }, { name: "Still queued", value: pending.map((p) => `${p.campaign}: ${p._count._all}`).join(" · ") || "none", inline: true }, {
        name: "Not measurable",
        value: "Discord emits no interaction for link buttons, so dashboard and pricing click-through cannot be counted from inside the bot. Read those from web analytics, not here.",
    })
        .setFooter({ text: "Fortify · drip" });
    try {
        const owner = await client.users.fetch(exports.OWNER_ID);
        await owner.send({ embeds: [embed] });
    }
    catch (e) {
        console.error("[drip] weekly report failed to send:", e);
        return false; // counters stay put; retried on the next tick
    }
    await db_1.db.dripMetric.upsert({
        where: { periodStart_key: { periodStart: period, key: "report_delivered" } },
        create: { periodStart: period, key: "report_delivered", count: 1 },
        update: { count: { increment: 1 } },
    });
    return true;
}
