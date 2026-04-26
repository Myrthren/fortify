import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db } from "../lib/db";
import { getOrCreateUser } from "../lib/usage";
import { TIER_LIMITS } from "../lib/tiers";

export const data = new SlashCommandBuilder()
  .setName("voice")
  .setDescription("Show your trained brand voices.");

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

  const voices = await db.brandVoice.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, isActive: true, createdAt: true },
  });

  const limit = TIER_LIMITS[user.tier].brandVoices;
  const limitDisplay = limit === Infinity ? "unlimited" : limit;

  const embed = new EmbedBuilder()
    .setTitle("Your brand voices")
    .setColor(0xffffff)
    .setFooter({ text: `${voices.length} / ${limitDisplay} used · Manage at fortify-io.netlify.app/dashboard/voice` });

  if (voices.length === 0) {
    embed.setDescription(
      user.tier === "FREE"
        ? "Brand Voice is a Pro feature. Run `/upgrade` to unlock."
        : "No voices yet. Train your first at fortify-io.netlify.app/dashboard/voice"
    );
  } else {
    embed.setDescription(
      voices
        .map(
          (v) =>
            `${v.isActive ? "🟢" : "⚪"} **${v.name}** — trained ${v.createdAt.toISOString().slice(0, 10)}`
        )
        .join("\n")
    );
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
