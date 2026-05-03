import "dotenv/config";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} from "discord.js";
import * as hook from "./commands/hook";
import * as upgrade from "./commands/upgrade";
import * as profile from "./commands/profile";
import * as voice from "./commands/voice";
import * as outreach from "./commands/outreach";
import * as audit from "./commands/audit";
import * as trends from "./commands/trends";
import * as competitors from "./commands/competitors";
import * as matchmake from "./commands/matchmake";
import * as ticket from "./commands/ticket";
import * as supportsetup from "./commands/supportsetup";
import { handleMention } from "./lib/chat";

type Command = { data: { name: string }; execute: (i: any) => Promise<void> };

const OWNER_ID = "731207920007643167";

const commands = new Collection<string, Command>();
for (const cmd of [
  hook, upgrade, profile, voice, outreach, audit, trends, competitors, matchmake, ticket, supportsetup,
] as Command[]) {
  commands.set(cmd.data.name, cmd);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged — must be enabled in Discord Dev Portal
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Fortify bot online as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "Command failed.", ephemeral: true });
      } else {
        await interaction.reply({ content: "Command failed.", ephemeral: true });
      }
    }
  } else if (interaction.isButton()) {
    await handleButtonInteraction(interaction as ButtonInteraction).catch((e) =>
      console.error("[button] error:", e)
    );
  } else if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction as ModalSubmitInteraction).catch((e) =>
      console.error("[modal] error:", e)
    );
  }
});

// ── Support: user clicks "Open a Ticket" from #support embed ─────────────────
async function handleButtonInteraction(interaction: ButtonInteraction) {
  const id = interaction.customId;

  // ── User clicks "Open a Ticket" from #support channel embed ──────────────
  if (id === "support_open_modal") {
    const modal = new ModalBuilder()
      .setCustomId(`support_modal_${interaction.user.id}_${Date.now().toString(36)}`)
      .setTitle("Open a Support Ticket");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("support_subject")
          .setLabel("What is this about?")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. Role not assigned after payment")
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("support_message")
          .setLabel("Describe your issue")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Include as much detail as possible…")
          .setRequired(true)
          .setMaxLength(1000)
      )
    );

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
    if (!guild) return;

    // Find the #support channel
    const supportChannel =
      guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.name === "❓｜support"
      ) ??
      guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.name.toLowerCase().includes("support")
      );

    if (!supportChannel || supportChannel.type !== ChannelType.GuildText) {
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
        type: ChannelType.PrivateThread,
        reason: `Support ticket for ${userDiscordId}`,
      });
    } catch {
      // Fallback to public thread if private threads aren't available (e.g. no boost)
      thread = await supportChannel.threads.create({
        name: threadName,
        autoArchiveDuration: 1440,
        reason: `Support ticket for ${userDiscordId}`,
      });
    }

    try { await thread.members.add(userDiscordId); } catch {}
    try { await thread.members.add(OWNER_ID); } catch {}

    await thread.send({
      content: `<@${userDiscordId}> <@${OWNER_ID}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(0xffffff)
          .setTitle("Support Ticket")
          .addFields(
            { name: "User",    value: `<@${userDiscordId}>`, inline: true },
            { name: "Subject", value: subject,                inline: true },
            { name: "Message", value: message.slice(0, 1024) }
          )
          .setFooter({ text: "Use /ticket close to archive · auto-archives after 24h" })
          .setTimestamp(),
      ],
    });

    // DM the user to let them know the ticket is open
    try {
      const user = await client.users.fetch(userDiscordId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xffffff)
            .setTitle("Your Support Ticket Has Been Opened")
            .setDescription(
              `Your message has been received and a ticket has been opened.\n\n` +
                `**[Click here to view your ticket](${thread.url})**\n\n` +
                `Reply in the thread and you'll hear back shortly. The ticket archives automatically after 24h of inactivity.`
            )
            .addFields({ name: "Subject", value: subject, inline: true })
            .setFooter({ text: "Fortify Support" }),
        ],
      });
    } catch {
      // User has DMs closed — thread link is in the channel itself
    }

    // Update owner DM buttons to reflect ticket opened
    const openedBtn = new ButtonBuilder()
      .setCustomId(`support_opened_${userDiscordId}`)
      .setLabel("✓ Ticket Opened")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);
    const dismissBtn = new ButtonBuilder()
      .setCustomId(`support_dismiss_${userDiscordId}`)
      .setLabel("Dismiss")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    await interaction.editReply({
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(openedBtn, dismissBtn)],
    });
    return;
  }

  // ── Owner clicks "Dismiss" ────────────────────────────────────────────────
  if (id.startsWith("support_dismiss_")) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "Owner only.", ephemeral: true });
    }

    await interaction.deferUpdate();

    const dismissedBtn = new ButtonBuilder()
      .setCustomId("support_dismissed")
      .setLabel("Dismissed")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    await interaction.editReply({
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(dismissedBtn)],
    });
  }
}

// ── Support: user submits the modal from #support embed ──────────────────────
async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  if (!interaction.customId.startsWith("support_modal_")) return;

  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;
  const username  = interaction.user.username;
  const subject   = interaction.fields.getTextInputValue("support_subject");
  const message   = interaction.fields.getTextInputValue("support_message");

  try {
    const owner = await client.users.fetch(OWNER_ID);

    const openBtn = new ButtonBuilder()
      .setCustomId(`support_open_${discordId}`)
      .setLabel("🎫  Open Ticket")
      .setStyle(ButtonStyle.Primary);

    const dismissBtn = new ButtonBuilder()
      .setCustomId(`support_dismiss_${discordId}`)
      .setLabel("Dismiss")
      .setStyle(ButtonStyle.Secondary);

    await owner.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffffff)
          .setTitle("Support Message")
          .addFields(
            { name: "From",    value: `${username} (\`${discordId}\`)`, inline: true },
            { name: "Subject", value: subject,                           inline: true },
            { name: "Message", value: message.slice(0, 1024) }
          )
          .setTimestamp()
          .setFooter({ text: "Fortify Support · from Discord" }),
      ],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(openBtn, dismissBtn)],
    });

    await interaction.editReply(
      "Your message has been received. You'll hear back via Discord DM once a ticket is opened."
    );
  } catch (e) {
    console.error("[support] Failed to DM owner:", e);
    await interaction.editReply(
      "Something went wrong sending your message. Please DM the server owner directly."
    );
  }
}

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!client.user) return;

  const mentioned =
    message.mentions.users.has(client.user.id) ||
    message.content.includes(`<@${client.user.id}>`);

  console.log(
    `[msg] ${message.author.username} in ${message.channelId} | mentioned=${mentioned} | content="${message.content.slice(0, 60)}"`
  );

  if (!mentioned) return;

  await handleMention(message).catch((err) => {
    console.error("handleMention error:", err);
    message.reply("Something went wrong. Try again.").catch(() => {});
  });
});

client.login(process.env.DISCORD_BOT_TOKEN);
