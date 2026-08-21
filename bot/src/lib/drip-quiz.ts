import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

/**
 * Stateless onboarding quiz.
 *
 * Every answer lives inside the button's own custom ID: "fq:213" means the user
 * picked option 2, then option 1, and is now choosing their third answer. The
 * handler is a pure function of that ID, which buys three things — a redeploy
 * mid-quiz costs nothing, there is no session table or in-memory map to leak,
 * and each click edits the same message so the user ends with one result rather
 * than a column of dead questions.
 *
 * Two constraints. Custom IDs cap at 100 characters, which is ample for four
 * digits and useless for free text. And the ID arrives from the client, so
 * every digit is validated as a real option index before it indexes anything.
 */

export const QUIZ_PREFIX = "fq:";

type Question = { prompt: string; options: string[] };

const QUESTIONS: Question[] = [
  {
    prompt: "What are you building?",
    options: ["Personal brand", "Agency / freelance", "Ecommerce brand", "Coaching / info product"],
  },
  {
    prompt: "Where does it stall right now?",
    options: ["Ideas and hooks", "Traffic that won't convert", "Finding clients or leads", "Posting consistently"],
  },
  {
    prompt: "How much are you shipping?",
    options: ["Not started yet", "A few posts a month", "Weekly", "Daily"],
  },
  {
    prompt: "Who is doing the work?",
    options: ["Just me", "Me and a VA", "Small team", "Five or more"],
  },
];

const TOOLS_BY_BOTTLENECK: string[][] = [
  ["Hook Generator — `/hook` or the dashboard", "Trend Radar — what is moving in your niche this week", "Content Inspiration — proven formats to model"],
  ["Funnel Auditor — paste a URL, get a scored teardown", "Brand Voice — trains on your writing so copy sounds like you", "Competitor Scanner — what their page does that yours doesn't"],
  ["Lead Extractor — pull qualified accounts with contact details", "Outreach Generator — `/outreach` writes the first message", "AI Matchmaking — `/matchmake` finds collaborators in the server"],
  ["Workflows — chain the tools and run them on a schedule", "Auto-Publish — queue a week of content in one sitting", "Brand Voice — kills the blank-page tax"],
];

/** Which tier actually earns its price at this shape of operation. */
function recommendTier(a: number[]): { tier: string; why: string } {
  const [, bottleneck, volume, team] = a;
  if (team === 3) {
    return { tier: "Apex — $199/mo", why: "At five or more people the concierge setup and custom workflows pay for themselves in a week." };
  }
  if (team === 2 || volume === 3) {
    return { tier: "Elite — $79/mo", why: "Daily output or a team means you need the competitor scanner and weekly strategy reports, not just generation." };
  }
  if (volume === 0 && team === 0) {
    return { tier: "Start on Free", why: "Ten generations a day is enough to prove the thing works before you pay for anything. Move to Pro when you hit the ceiling." };
  }
  return {
    tier: "Pro — $29/mo",
    why: bottleneck === 1
      ? "Unlimited audits-adjacent work plus Brand Voice is the fastest fix for a page that gets traffic and no conversions."
      : "Unlimited generations and Brand Voice are the two things you will hit first.",
  };
}

/** Parse a quiz custom ID into validated answer indices, or null if tampered. */
export function parseAnswers(customId: string): number[] | null {
  if (!customId.startsWith(QUIZ_PREFIX)) return null;
  const raw = customId.slice(QUIZ_PREFIX.length);
  if (raw.length > QUESTIONS.length) return null;

  const answers: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const n = Number(raw[i]);
    // Each digit must be a real option index for the question it answers.
    if (!Number.isInteger(n) || n < 0 || n >= QUESTIONS[i].options.length) return null;
    answers.push(n);
  }
  return answers;
}

/** The question card for however many answers are already encoded. */
export function questionMessage(answers: number[]) {
  const q = QUESTIONS[answers.length];
  const prefix = answers.join("");

  const embed = new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle(`Question ${answers.length + 1} of ${QUESTIONS.length}`)
    .setDescription(q.prompt)
    .setFooter({ text: "Fortify · takes about thirty seconds" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...q.options.map((label, i) =>
      new ButtonBuilder()
        .setCustomId(`${QUIZ_PREFIX}${prefix}${i}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embed], components: [row] };
}

/** The final card once all four answers are in. */
export function resultMessage(answers: number[]) {
  const [building, bottleneck] = answers;
  const { tier, why } = recommendTier(answers);
  const tools = TOOLS_BY_BOTTLENECK[bottleneck];

  const embed = new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle("Here is where to start")
    .setDescription(
      `**${QUESTIONS[0].options[building]}**, stalling on **${QUESTIONS[1].options[bottleneck].toLowerCase()}**.\n\n` +
        `Open these three first, in this order:`
    )
    .addFields(
      { name: "1", value: tools[0] },
      { name: "2", value: tools[1] },
      { name: "3", value: tools[2] },
      { name: "Worth paying for", value: `**${tier}** — ${why}` }
    )
    .setFooter({ text: "Fortify · fortify-io.com/dashboard" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("Open dashboard").setStyle(ButtonStyle.Link).setURL("https://fortify-io.com/dashboard"),
    new ButtonBuilder().setLabel("See tiers").setStyle(ButtonStyle.Link).setURL("https://fortify-io.com/pricing")
  );

  return { embeds: [embed], components: [row] };
}

/** The opening card, sent as its own DM by the drip flows. */
export function quizOpener() {
  return questionMessage([]);
}

export const QUIZ_LENGTH = QUESTIONS.length;

/**
 * Handles any `fq:` click. Returns which metric to count, or null when the ID
 * was refused — a tampered ID is still acknowledged so the client does not
 * show a failure.
 */
export async function handleQuizClick(
  interaction: ButtonInteraction
): Promise<"quiz_started" | "quiz_advanced" | "quiz_completed" | null> {
  const answers = parseAnswers(interaction.customId);
  if (answers === null) {
    await interaction.deferUpdate().catch(() => {});
    return null;
  }

  if (answers.length < QUIZ_LENGTH) {
    await interaction.update(questionMessage(answers));
    return answers.length === 1 ? "quiz_started" : "quiz_advanced";
  }

  await interaction.update(resultMessage(answers));
  return "quiz_completed";
}
