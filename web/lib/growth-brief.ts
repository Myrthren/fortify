import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { advisorSystemPrompt, buildAdvisorContext, inventedTools } from "@/lib/advisor";
import { sendDMConditional } from "@/lib/notifications";
import { unsupportedFigures } from "@/lib/facts";

// Monthly Growth Brief (Apex): once a calendar month, the AI Advisor writes a
// plan from everything Fortify knows about the member plus what they did in
// the last 30 days. New Apex members get their first one within the hour.
// Saved as an Advisor session (title starts with "Strategy:", which is what
// the Advisor page lists), with a notification and a Discord DM.
//
// A cron runs hourly and writes at most one brief per tick, so a single
// request stays well inside Netlify's 60-second limit.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function briefMonth(now: Date): string {
  return `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}

export function briefTitle(now: Date): string {
  return `Strategy: Growth Brief — ${briefMonth(now)}`;
}

/** What the member actually did in the last 30 days, as plain counts. */
async function recentActivity(userId: string, since: Date): Promise<string> {
  const [searches, runs, generations] = await Promise.all([
    db.reconSearch.findMany({ where: { userId, createdAt: { gte: since } }, select: { totalLeads: true, filters: true, category: true, location: true } }),
    db.workflowRun.findMany({ where: { workflow: { userId }, startedAt: { gte: since } }, select: { status: true } }),
    db.generation.groupBy({ by: ["type"], where: { userId, type: { not: "credit-job" }, createdAt: { gte: since } }, _count: { _all: true } }),
  ]);

  const lines = ["\n## Activity in the last 30 days (counts from Fortify's records)"];
  const packs = searches.filter((s) => (s.filters as { pack?: boolean } | null)?.pack);
  const manual = searches.length - packs.length;
  lines.push(`- Weekly lead packs delivered: ${packs.length} (${packs.reduce((n, s) => n + s.totalLeads, 0)} leads)`);
  lines.push(`- Recon searches run by hand: ${manual} (${searches.filter((s) => !(s.filters as any)?.pack).reduce((n, s) => n + s.totalLeads, 0)} leads)`);
  const targets = [...new Set(searches.map((s) => `${s.category ?? "?"} in ${s.location}`))].slice(0, 5);
  if (targets.length) lines.push(`- Lead targets: ${targets.join("; ")}`);
  const failed = runs.filter((r) => r.status === "failed").length;
  lines.push(`- Workflow runs: ${runs.length} (${failed} failed)`);
  if (generations.length) {
    lines.push(`- AI tool use: ${generations.sort((a, b) => b._count._all - a._count._all).map((g) => `${g.type} ${g._count._all}×`).join(", ")}`);
  } else {
    lines.push("- AI tool use: none recorded");
  }
  return lines.join("\n");
}

const BRIEF_REQUEST = (month: string) => `Write my Growth Brief for ${month}.

Use exactly these sections:
## Where things stand
What my data says about the business right now. If something important is missing (no Company DNA, no competitors tracked, no lead activity), say so plainly and tell me which Fortify tool fixes it.
## What changed this month
From the activity counts and context. If little happened, say that rather than inventing movement.
## Three priorities for ${month}
Each with why it matters for my business specifically.
## This week
A numbered list of 3–6 concrete actions, each naming the Fortify tool to use.

Keep it under 900 words. Use only facts in the context: never invent figures, results, competitor moves or customer names. Where you're inferring, say so.`;

/** Drafts one member's brief without saving it. Returns any problems left. */
export async function composeGrowthBrief(userId: string, now: Date) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [context, activity] = await Promise.all([
    buildAdvisorContext(userId),
    recentActivity(userId, since),
  ]);

  const month = briefMonth(now);
  const request = BRIEF_REQUEST(month);
  const system = advisorSystemPrompt(context + "\n" + activity);
  const write = async (extra = "") => {
    const res = await claude(userId).messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 2500,
      system,
      messages: [{ role: "user", content: request + extra }],
    });
    return res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
  };

  // Models still invent plausible tool names and numbers. Check both against
  // the real tool list and the member's own data, and allow one rewrite.
  const problems = (text: string) => ({
    tools: inventedTools(text, system),
    figures: unsupportedFigures(text, system, request),
  });
  let brief = await write();
  if (!brief) throw new Error("Empty brief");
  const first = problems(brief);
  const count = (p: ReturnType<typeof problems>) => p.tools.length + p.figures.length;
  if (count(first)) {
    const notes = [
      first.tools.length ? `These are not Fortify tools and must not appear: ${first.tools.join(", ")}. Use only the listed tools, by their exact names.` : "",
      first.figures.length ? `These figures are not in my data, so remove them: ${first.figures.join(", ")}.` : "",
    ].filter(Boolean).join(" ");
    const retry = await write(`\n\n${notes}`);
    if (retry && count(problems(retry)) < count(first)) brief = retry;
  }
  return { brief, month, remaining: problems(brief), rewritten: count(first) > 0 };
}

/** Writes and saves one member's brief for the month of `now`. */
export async function writeGrowthBrief(userId: string, now: Date) {
  const [{ brief, month }, user] = await Promise.all([
    composeGrowthBrief(userId, now),
    db.user.findUnique({ where: { id: userId }, select: { discordId: true } }),
  ]);

  const session = await db.chatSession.create({
    data: {
      userId,
      title: briefTitle(now),
      messages: [
        { role: "user", content: `Monthly Growth Brief for ${month}` },
        { role: "assistant", content: brief },
      ],
      createdAt: now,
      updatedAt: now,
    },
  });

  await db.notification.create({
    data: { userId, type: "system", title: `Your ${month} Growth Brief is ready`, body: "Your Advisor's plan for this month, from your own data.", link: "/dashboard/decisions/archive" },
  });
  if (user?.discordId) {
    await sendDMConditional(
      user.discordId,
      userId,
      "dmWeeklyReport",
      `Your ${month} Growth Brief is ready: where things stand, three priorities and this week's actions.\nhttps://fortify-io.com/dashboard/decisions/archive`,
    );
  }
  return session.id;
}

/** One cron tick: the first Apex member without this month's brief gets one. */
export async function growthBriefTick(now = new Date()) {
  const title = briefTitle(now);
  const apex = await db.user.findMany({ where: { tier: "APEX" }, select: { id: true }, orderBy: { createdAt: "asc" } });
  if (!apex.length) return { due: 0, written: null as string | null };

  const done = await db.chatSession.findMany({
    where: { userId: { in: apex.map((u) => u.id) }, title },
    select: { userId: true },
  });
  const doneIds = new Set(done.map((d) => d.userId));
  const due = apex.filter((u) => !doneIds.has(u.id));
  if (!due.length) return { due: 0, written: null };

  await writeGrowthBrief(due[0].id, now);
  return { due: due.length - 1, written: due[0].id };
}
