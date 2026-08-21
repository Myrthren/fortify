"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const discord_js_1 = require("discord.js");
const hook = __importStar(require("./commands/hook"));
const upgrade = __importStar(require("./commands/upgrade"));
const profile = __importStar(require("./commands/profile"));
const profileEdit = __importStar(require("./commands/profile-edit"));
const profile_edit_1 = require("./commands/profile-edit");
const voice = __importStar(require("./commands/voice"));
const outreach = __importStar(require("./commands/outreach"));
const audit = __importStar(require("./commands/audit"));
const trends = __importStar(require("./commands/trends"));
const competitors = __importStar(require("./commands/competitors"));
const matchmake = __importStar(require("./commands/matchmake"));
const ticket = __importStar(require("./commands/ticket"));
const supportsetup = __importStar(require("./commands/supportsetup"));
const drip = __importStar(require("./commands/drip"));
const chat_1 = require("./lib/chat");
const drip_1 = require("./lib/drip");
const drip_quiz_1 = require("./lib/drip-quiz");
const drip_scheduler_1 = require("./lib/drip-scheduler");
const OWNER_ID = "731207920007643167";
const commands = new discord_js_1.Collection();
for (const cmd of [
    hook, upgrade, profile, profileEdit, voice, outreach, audit, trends, competitors, matchmake, ticket, supportsetup, drip,
]) {
    commands.set(cmd.data.name, cmd);
}
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent, // privileged — must be enabled in Discord Dev Portal
        discord_js_1.GatewayIntentBits.GuildMembers, // privileged — needed for admin find_member lookups
    ],
});
client.once(discord_js_1.Events.ClientReady, (c) => {
    console.log(`✅ Fortify bot online as ${c.user.tag} — build includes role-toggle handler`);
    (0, drip_scheduler_1.startDripScheduler)(c);
});
// ── Drip: someone joins the server ───────────────────────────────────────────
client.on(discord_js_1.Events.GuildMemberAdd, async (member) => {
    await (0, drip_1.handleJoin)(member).catch((e) => console.error("[drip] join handler failed:", e));
});
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);
        if (!command)
            return;
        try {
            await command.execute(interaction);
        }
        catch (err) {
            console.error(err);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: "Command failed.", ephemeral: true });
            }
            else {
                await interaction.reply({ content: "Command failed.", ephemeral: true });
            }
        }
    }
    else if (interaction.isButton()) {
        await handleButtonInteraction(interaction).catch(async (e) => {
            console.error("[button] error:", e);
            try {
                const msg = { content: "Something went wrong. Please try again.", ephemeral: true };
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(msg.content);
                }
                else {
                    await interaction.reply(msg);
                }
            }
            catch { }
        });
    }
    else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction).catch((e) => console.error("[modal] error:", e));
    }
});
// ── Support: user clicks "Open a Ticket" from #support embed ─────────────────
async function handleButtonInteraction(interaction) {
    const id = interaction.customId;
    // ── Onboarding quiz: every answer lives in the button's own ID ────────────
    if (id.startsWith(drip_quiz_1.QUIZ_PREFIX)) {
        const outcome = await (0, drip_quiz_1.handleQuizClick)(interaction);
        if (outcome === "quiz_started" || outcome === "quiz_completed")
            await (0, drip_1.bump)(outcome);
        return;
    }
    // ── Drip opt-out ─────────────────────────────────────────────────────────
    if (id === "drip_stop") {
        await (0, drip_1.optOut)(interaction.user.id);
        return interaction.reply({
            content: "Done — no more Fortify DMs from me. The bot still answers you in the server and by mention.",
            ephemeral: true,
        });
    }
    // ── Role toggle button (e.g. "role_toggle_1469480118912024791") ───────────
    if (id.startsWith("role_toggle_")) {
        const roleId = id.slice("role_toggle_".length);
        const guild = interaction.guild;
        if (!guild)
            return interaction.reply({ content: "Server not found.", ephemeral: true });
        const member = await guild.members.fetch(interaction.user.id);
        const hasRole = member.roles.cache.has(roleId);
        if (hasRole) {
            await member.roles.remove(roleId);
            return interaction.reply({ content: "✅ Role removed — you'll no longer receive update notifications.", ephemeral: true });
        }
        else {
            await member.roles.add(roleId);
            return interaction.reply({ content: "✅ You now have the **Fortify Updates** role and will be notified of platform changes.", ephemeral: true });
        }
    }
    // ── User clicks "Open a Ticket" from #support channel embed ──────────────
    if (id === "support_open_modal") {
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`support_modal_${interaction.user.id}_${Date.now().toString(36)}`)
            .setTitle("Open a Support Ticket");
        modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
            .setCustomId("support_subject")
            .setLabel("What is this about?")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setPlaceholder("e.g. Role not assigned after payment")
            .setRequired(true)
            .setMaxLength(100)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
            .setCustomId("support_message")
            .setLabel("Describe your issue")
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setPlaceholder("Include as much detail as possible…")
            .setRequired(true)
            .setMaxLength(1000)));
        await interaction.showModal(modal);
        return;
    }
    // ── Owner clicks "Open Ticket" from DM (web form or Discord modal) ────────
    if (id.startsWith("support_open_")) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: "Owner only.", ephemeral: true });
        }
        await interaction.deferUpdate();
        const userDiscordId = id.slice("support_open_".length);
        // Read ticket details from the embed in the owner's DM
        const embed = interaction.message.embeds[0];
        const subject = embed?.fields?.find((f) => f.name === "Subject")?.value ?? "General enquiry";
        const message = embed?.fields?.find((f) => f.name === "Message")?.value ?? "*(see original message)*";
        const fromField = embed?.fields?.find((f) => f.name === "From")?.value ?? "user";
        // Extract just the display name (before the code block with the Discord ID)
        const username = fromField.split(" (")[0].replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 20);
        const guild = client.guilds.cache.first();
        if (!guild)
            return;
        // Find the #support channel
        const supportChannel = guild.channels.cache.find((c) => c.type === discord_js_1.ChannelType.GuildText && c.name === "❓｜support") ??
            guild.channels.cache.find((c) => c.type === discord_js_1.ChannelType.GuildText && c.name.toLowerCase().includes("support"));
        if (!supportChannel || supportChannel.type !== discord_js_1.ChannelType.GuildText) {
            return interaction.editReply({
                content: "No support channel found. Run `/supportsetup` first.",
                components: [],
            });
        }
        const threadName = `ticket-${username}-${Date.now().toString(36)}`;
        let thread;
        try {
            thread = await supportChannel.threads.create({
                name: threadName,
                autoArchiveDuration: 1440,
                type: discord_js_1.ChannelType.PrivateThread,
                reason: `Support ticket for ${userDiscordId}`,
            });
        }
        catch {
            // Fallback to public thread if private threads aren't available (e.g. no boost)
            thread = await supportChannel.threads.create({
                name: threadName,
                autoArchiveDuration: 1440,
                reason: `Support ticket for ${userDiscordId}`,
            });
        }
        try {
            await thread.members.add(userDiscordId);
        }
        catch { }
        try {
            await thread.members.add(OWNER_ID);
        }
        catch { }
        await thread.send({
            content: `<@${userDiscordId}> <@${OWNER_ID}>`,
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(0xffffff)
                    .setTitle("Support Ticket")
                    .addFields({ name: "User", value: `<@${userDiscordId}>`, inline: true }, { name: "Subject", value: subject, inline: true }, { name: "Message", value: message.slice(0, 1024) })
                    .setFooter({ text: "Use /ticket close to archive · auto-archives after 24h" })
                    .setTimestamp(),
            ],
        });
        // DM the user to let them know the ticket is open
        try {
            const user = await client.users.fetch(userDiscordId);
            await user.send({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setColor(0xffffff)
                        .setTitle("Your Support Ticket Has Been Opened")
                        .setDescription(`Your message has been received and a ticket has been opened.\n\n` +
                        `**[Click here to view your ticket](${thread.url})**\n\n` +
                        `Reply in the thread and you'll hear back shortly. The ticket archives automatically after 24h of inactivity.`)
                        .addFields({ name: "Subject", value: subject, inline: true })
                        .setFooter({ text: "Fortify Support" }),
                ],
            });
        }
        catch {
            // User has DMs closed — thread link is in the channel itself
        }
        // Update owner DM buttons to reflect ticket opened
        const openedBtn = new discord_js_1.ButtonBuilder()
            .setCustomId(`support_opened_${userDiscordId}`)
            .setLabel("✓ Ticket Opened")
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setDisabled(true);
        const dismissBtn = new discord_js_1.ButtonBuilder()
            .setCustomId(`support_dismiss_${userDiscordId}`)
            .setLabel("Dismiss")
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(true);
        await interaction.editReply({
            components: [new discord_js_1.ActionRowBuilder().addComponents(openedBtn, dismissBtn)],
        });
        return;
    }
    // ── Owner clicks "Dismiss" ────────────────────────────────────────────────
    if (id.startsWith("support_dismiss_")) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: "Owner only.", ephemeral: true });
        }
        await interaction.deferUpdate();
        const dismissedBtn = new discord_js_1.ButtonBuilder()
            .setCustomId("support_dismissed")
            .setLabel("Dismissed")
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(true);
        await interaction.editReply({
            components: [new discord_js_1.ActionRowBuilder().addComponents(dismissedBtn)],
        });
    }
}
// ── Support: user submits the modal from #support embed ──────────────────────
async function handleModalSubmit(interaction) {
    if (interaction.customId.startsWith("profile_edit_modal_")) {
        await (0, profile_edit_1.handleProfileEditModal)(interaction);
        return;
    }
    if (!interaction.customId.startsWith("support_modal_"))
        return;
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.user.id;
    const username = interaction.user.username;
    const subject = interaction.fields.getTextInputValue("support_subject");
    const message = interaction.fields.getTextInputValue("support_message");
    try {
        const owner = await client.users.fetch(OWNER_ID);
        const openBtn = new discord_js_1.ButtonBuilder()
            .setCustomId(`support_open_${discordId}`)
            .setLabel("🎫  Open Ticket")
            .setStyle(discord_js_1.ButtonStyle.Primary);
        const dismissBtn = new discord_js_1.ButtonBuilder()
            .setCustomId(`support_dismiss_${discordId}`)
            .setLabel("Dismiss")
            .setStyle(discord_js_1.ButtonStyle.Secondary);
        await owner.send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(0xffffff)
                    .setTitle("Support Message")
                    .addFields({ name: "From", value: `${username} (\`${discordId}\`)`, inline: true }, { name: "Subject", value: subject, inline: true }, { name: "Message", value: message.slice(0, 1024) })
                    .setTimestamp()
                    .setFooter({ text: "Fortify Support · from Discord" }),
            ],
            components: [new discord_js_1.ActionRowBuilder().addComponents(openBtn, dismissBtn)],
        });
        await interaction.editReply("Your message has been received. You'll hear back via Discord DM once a ticket is opened.");
    }
    catch (e) {
        console.error("[support] Failed to DM owner:", e);
        await interaction.editReply("Something went wrong sending your message. Please DM the server owner directly.");
    }
}
client.on(discord_js_1.Events.MessageCreate, async (message) => {
    if (message.author.bot)
        return;
    if (!client.user)
        return;
    const mentioned = message.mentions.users.has(client.user.id) ||
        message.content.includes(`<@${client.user.id}>`);
    console.log(`[msg] ${message.author.username} in ${message.channelId} | mentioned=${mentioned} | content="${message.content.slice(0, 60)}"`);
    if (!mentioned)
        return;
    await (0, chat_1.handleMention)(message).catch((err) => {
        console.error("handleMention error:", err);
        message.reply("Something went wrong. Try again.").catch(() => { });
    });
});
client.login(process.env.DISCORD_BOT_TOKEN);
