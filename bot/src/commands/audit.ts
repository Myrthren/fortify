import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { getOrCreateUser, checkMonthly, logGeneration } from "../lib/usage";
import { TIER_LIMITS } from "../lib/tiers";
import { auditUrl } from "../lib/audit";

export const data = new SlashCommandBuilder()
  .setName("audit")
  .setDescription("Audit a landing page or funnel URL.")
  .addStringOption((o) =>
    o.setName("url").setDescription("Page URL to audit").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const url = interaction.options.getString("url", true);
  await interaction.deferReply({ ephemeral: true });

  const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
  const limit = TIER_LIMITS[user.tier].monthlyAudits;
  const { ok, used } = await checkMonthly(user.id, "audit", limit);
  if (!ok) {
    await interaction.editReply(
      limit === 0
        ? "Funnel Auditor is a paid feature. Run `/upgrade` to unlock."
        : `You've used ${used}/${limit} audits this month. Upgrade for more.`
    );
    return;
  }

  try {
    const result = await auditUrl(url);
    await logGeneration(user.id, "audit", url, JSON.stringify(result));

    const avgScore = (
      Object.values(result.scores).reduce((a, b) => a + b, 0) /
      Object.keys(result.scores).length
    ).toFixed(1);

    const scoresStr = Object.entries(result.scores)
      .map(([k, v]) => `**${k}**: ${v}/10 ${bar(v)}`)
      .join("\n");

    const topIssues = result.issues
      .filter((i) => i.severity === "high")
      .slice(0, 3)
      .concat(result.issues.filter((i) => i.severity === "med").slice(0, 2))
      .slice(0, 4);

    const embed = new EmbedBuilder()
      .setTitle(`Audit — ${result.title?.slice(0, 100) ?? result.url}`)
      .setURL(result.url)
      .setColor(scoreColor(parseFloat(avgScore)))
      .setDescription(result.summary.slice(0, 1500))
      .addFields(
        { name: `Scores (avg ${avgScore}/10)`, value: scoresStr.slice(0, 1000) },
        ...(topIssues.length
          ? [
              {
                name: "Top issues",
                value: topIssues
                  .map((i) => `**[${i.severity.toUpperCase()}]** ${i.area}: ${i.note}`)
                  .join("\n")
                  .slice(0, 1000),
              },
            ]
          : []),
        ...(result.fixes.length
          ? [
              {
                name: "Top fixes",
                value: result.fixes
                  .slice(0, 5)
                  .map((f, i) => `${i + 1}. ${f}`)
                  .join("\n")
                  .slice(0, 1000),
              },
            ]
          : [])
      )
      .setFooter({ text: "Full report at fortify-io.com/dashboard/audit" });

    await interaction.editReply({ embeds: [embed] });
  } catch (e: any) {
    console.error("[/audit]", e);
    await interaction.editReply(`Audit failed: ${e.message}`);
  }
}

function bar(v: number): string {
  const filled = Math.round(v);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function scoreColor(avg: number): number {
  if (avg >= 8) return 0x22c55e;
  if (avg >= 6) return 0xeab308;
  if (avg >= 4) return 0xf97316;
  return 0xef4444;
}
