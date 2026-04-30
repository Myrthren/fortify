import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { db } from "../lib/db";
import { getOrCreateUser } from "../lib/usage";
import { claude, CLAUDE_MODELS } from "../lib/claude";

export const data = new SlashCommandBuilder()
  .setName("matchmake")
  .setDescription("Find your top member matches with AI (Pro+).");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const user = await getOrCreateUser(interaction.user.id, interaction.user.username);

  if (user.tier === "FREE") {
    await interaction.editReply("AI Matchmaking is a Pro+ feature. Run `/upgrade` to unlock.");
    return;
  }

  const myProfile = await db.profile.findUnique({ where: { userId: user.id } });
  if (!myProfile || (!myProfile.niche && myProfile.skills.length === 0 && myProfile.canOffer.length === 0)) {
    await interaction.editReply(
      "Set up your profile first at fortify-io.com/dashboard/profile — matchmaking needs your niche, skills, and what you offer."
    );
    return;
  }

  const candidates = await db.profile.findMany({
    where: { userId: { not: user.id } },
    include: { user: { select: { name: true } } },
    take: 40,
  });

  if (candidates.length === 0) {
    await interaction.editReply("Not enough members with profiles yet. Check back soon.");
    return;
  }

  const meBlock = [
    myProfile.niche ? `niche: ${myProfile.niche}` : null,
    myProfile.skills.length ? `skills: ${myProfile.skills.join(", ")}` : null,
    myProfile.lookingFor.length ? `looking for: ${myProfile.lookingFor.join(", ")}` : null,
    myProfile.canOffer.length ? `can offer: ${myProfile.canOffer.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const candidatesBlock = candidates
    .map((c) =>
      [
        `id: ${c.userId}`,
        `name: ${c.user.name ?? "Unknown"}`,
        c.niche ? `niche: ${c.niche}` : null,
        c.skills.length ? `skills: ${c.skills.join(", ")}` : null,
        c.lookingFor.length ? `looking for: ${c.lookingFor.join(", ")}` : null,
        c.canOffer.length ? `can offer: ${c.canOffer.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n---\n");

  try {
    const res = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 800,
      system:
        "You are a sharp networking analyst. Find the top 3 matches for this member. Output ONLY a JSON array with objects: { name, why, starter }. why = 1 sentence on the fit. starter = 1-line opener they could send. No markdown fences.",
      messages: [
        {
          role: "user",
          content: `Me:\n${meBlock}\n\nCandidates:\n${candidatesBlock}\n\nReturn top 3 as JSON array.`,
        },
      ],
    });

    const raw = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");

    const matches: { name: string; why: string; starter: string }[] = JSON.parse(raw);

    const embed = new EmbedBuilder()
      .setTitle("Your top matches")
      .setColor(0xffffff)
      .setDescription(
        matches
          .slice(0, 3)
          .map(
            (m, i) =>
              `**${i + 1}. ${m.name}**\n${m.why}\n_Opener: "${m.starter}"_`
          )
          .join("\n\n")
      )
      .setFooter({ text: "Full matchmaking at fortify-io.com/dashboard/matchmaking" });

    await interaction.editReply({ embeds: [embed] });
  } catch (e: any) {
    console.error("[/matchmake]", e);
    await interaction.editReply(`Matchmaking failed: ${e.message}`);
  }
}
