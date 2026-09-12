import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelType,
  TextChannel,
} from "discord.js";
import { OWNER_ID } from "../lib/drip";

/**
 * Posts the pinned #info embed. Mirrors /supportsetup: owner-only, one-time,
 * finds the channel by name unless one is passed explicitly.
 *
 * The quiz button here is `fq_start`, NOT a bare `fq:` button. A `fq:` button
 * edits the message it lives on, which is right in a DM and wrong on a channel
 * post — the first click would rewrite the pinned embed for everyone. The
 * handler for `fq_start` replies ephemerally instead, and the per-answer `fq:`
 * buttons then edit that private copy, one per member.
 */

export const data = new SlashCommandBuilder()
  .setName("infosetup")
  .setDescription("Post the Fortify info embed to #info — owner only, one-time")
  .addChannelOption((o) =>
    o
      .setName("channel")
      .setDescription("Where to post it (defaults to the info channel)")
      .addChannelTypes(ChannelType.GuildText)
  );

export function infoEmbed() {
  return new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle("Fortify")
    .setDescription(
      "An AI operating system for creators and operators. Hooks, funnel audits, competitor scans, trend radar, lead sourcing and publishing — one dashboard, one subscription.\n\n" +
        "The free tier is ten generations a day and needs no card."
    )
    .addFields(
      {
        name: "Getting started",
        value:
          "Sign in with Discord at **fortify-io.com** and your account links to this server automatically. " +
          "Subscribe and your tier role shows up here within a minute.",
      },
      {
        name: "Use it without leaving Discord",
        value:
          "`/hook` hooks that stop the scroll\n" +
          "`/audit` score any landing page\n" +
          "`/trends` what is moving in your niche\n" +
          "`/matchmake` find collaborators in here\n" +
          "`/profile` your tier and usage\n" +
          "Or @mention the bot with any question.",
      },
      {
        name: "Tiers",
        value:
          "**Free** · ten generations a day\n" +
          "**Pro £29** · unlimited AI, Brand Voice, audits, trend radar\n" +
          "**Elite £79** · competitor scanner, weekly strategy reports\n" +
          "**Apex £199** · Claude Opus, custom workflows, auto-publish",
      },
      {
        name: "Not sure where to start",
        value:
          "Four questions, thirty seconds, and it names the three tools to open first. Only you see the answers.",
      }
    )
    .setFooter({ text: "Fortify · fortify-io.com · support tickets in the support channel" });
}

export function infoButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("fq_start").setLabel("Find my starting point").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setLabel("Open dashboard").setStyle(ButtonStyle.Link).setURL("https://fortify-io.com/dashboard"),
    new ButtonBuilder().setLabel("See tiers").setStyle(ButtonStyle.Link).setURL("https://fortify-io.com/pricing")
  );
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (interaction.user.id !== OWNER_ID) {
    return interaction.editReply("Owner only.");
  }

  const guild = interaction.guild;
  if (!guild) return interaction.editReply("Must be run inside the server.");

  const picked = interaction.options.getChannel("channel");
  // Channel names carry emoji and separators (e.g. "ℹ｜info"), so match on a
  // substring rather than equality.
  const channel = (picked ??
    guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name.toLowerCase().includes("info")
    )) as TextChannel | undefined;

  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.editReply(
      "No text channel with 'info' in the name found. Pass one with the `channel` option."
    );
  }

  const message = await channel.send({ embeds: [infoEmbed()], components: [infoButtons()] });
  await message.pin().catch(() => {});

  await interaction.editReply(
    `Info embed posted to <#${channel.id}> and pinned. The quiz button replies privately, so every member gets their own copy.`
  );
}
