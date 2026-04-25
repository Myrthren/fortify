import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { generateHooks } from "../lib/openai";
import { canGenerate, getOrCreateUser, logGeneration } from "../lib/usage";

export const data = new SlashCommandBuilder()
  .setName("hook")
  .setDescription("Generate 5 viral hooks for a topic.")
  .addStringOption((opt) =>
    opt.setName("topic").setDescription("What's the video about?").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const topic = interaction.options.getString("topic", true);
  await interaction.deferReply({ ephemeral: true });

  const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
  const ok = await canGenerate(user.id, user.tier);
  if (!ok) {
    await interaction.editReply(
      "You've hit your daily free limit. Run `/upgrade` to unlock unlimited generations."
    );
    return;
  }

  try {
    const hooks = await generateHooks(topic, 5);
    await logGeneration(user.id, "hook", topic, hooks.join("\n"));

    const embed = new EmbedBuilder()
      .setTitle(`Hooks for "${topic}"`)
      .setColor(0xffffff)
      .setDescription(hooks.map((h, i) => `**${i + 1}.** ${h}`).join("\n\n"))
      .setFooter({ text: `Fortify · ${user.tier}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (e) {
    console.error(e);
    await interaction.editReply("Something broke. Try again in a moment.");
  }
}
