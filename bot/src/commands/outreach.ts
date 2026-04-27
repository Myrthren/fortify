import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { db } from "../lib/db";
import { getOrCreateUser, checkMonthly, logGeneration } from "../lib/usage";
import { TIER_LIMITS } from "../lib/tiers";
import { generateOutreach, OUTREACH_CHANNELS, type OutreachChannel } from "../lib/outreach";

export const data = new SlashCommandBuilder()
  .setName("outreach")
  .setDescription("Generate cold outreach for a prospect.")
  .addStringOption((o) =>
    o.setName("channel").setDescription("Where you'll send it").setRequired(true).addChoices(
      { name: "Twitter DM", value: "dm" },
      { name: "LinkedIn", value: "linkedin" },
      { name: "Email", value: "email" },
      { name: "Cold sales email", value: "cold-email" }
    )
  )
  .addStringOption((o) =>
    o
      .setName("prospect")
      .setDescription("Who they are — bio, role, recent post (min 20 chars)")
      .setRequired(true)
      .setMinLength(20)
      .setMaxLength(500)
  )
  .addStringOption((o) =>
    o
      .setName("offer")
      .setDescription("What you want / are offering (min 10 chars)")
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getString("channel", true) as OutreachChannel;
  const prospect = interaction.options.getString("prospect", true);
  const offer = interaction.options.getString("offer", true);

  if (!OUTREACH_CHANNELS.includes(channel)) {
    await interaction.reply({ content: "Invalid channel.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
  const limit = TIER_LIMITS[user.tier].monthlyOutreach;
  const { ok, used } = await checkMonthly(user.id, "outreach", limit);
  if (!ok) {
    await interaction.editReply(
      limit === 0
        ? "Cold Outreach is a paid feature. Run `/upgrade` to unlock."
        : `You've used ${used}/${limit} outreach messages this month. Upgrade for more.`
    );
    return;
  }

  const activeVoice = await db.brandVoice.findFirst({
    where: { userId: user.id, isActive: true },
    select: { systemPrompt: true, name: true },
  });

  try {
    const message = await generateOutreach({
      prospect,
      offer,
      channel,
      voiceSystemPrompt: activeVoice?.systemPrompt,
    });

    await logGeneration(user.id, "outreach", JSON.stringify({ channel, prospect, offer }), message);

    const embed = new EmbedBuilder()
      .setTitle(`Outreach — ${channel}`)
      .setColor(0xffffff)
      .setDescription("```\n" + message.slice(0, 3800) + "\n```")
      .setFooter({
        text: activeVoice
          ? `In voice: ${activeVoice.name} · Fortify`
          : `Fortify · set an active voice at fortify-io.com/dashboard/voice`,
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (e: any) {
    console.error("[/outreach]", e);
    await interaction.editReply(`Generation failed: ${e.message}`);
  }
}
