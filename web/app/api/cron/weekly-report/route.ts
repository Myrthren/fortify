import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { sendDMConditional } from "@/lib/notifications";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const users = await db.user.findMany({
    where: { tier: { in: ["PRO", "ELITE", "APEX"] }, discordId: { not: null } },
    select: {
      id: true,
      name: true,
      discordId: true,
      tier: true,
      generations: {
        where: { createdAt: { gte: since } },
        select: { type: true },
      },
      brandVoices: { select: { name: true, isActive: true } },
      competitors: { select: { name: true, lastScanned: true } },
      watchTerms: { select: { term: true } },
    },
  });

  let sent = 0;
  for (const user of users) {
    if (!user.discordId) continue;

    const genCounts: Record<string, number> = {};
    for (const g of user.generations) {
      genCounts[g.type] = (genCounts[g.type] ?? 0) + 1;
    }
    const totalGens = user.generations.length;
    const activeVoice = user.brandVoices.find((v) => v.isActive);
    const scannedThisWeek = user.competitors.filter(
      (c) => c.lastScanned && c.lastScanned >= since
    ).length;

    const activitySummary = [
      `Tier: ${user.tier}`,
      `Total AI generations this week: ${totalGens}`,
      ...Object.entries(genCounts).map(([type, n]) => `  - ${type}: ${n}`),
      activeVoice ? `Active brand voice: ${activeVoice.name}` : "No active brand voice",
      user.competitors.length
        ? `Tracking ${user.competitors.length} competitor(s), ${scannedThisWeek} scanned this week`
        : "No competitors tracked",
      user.watchTerms.length
        ? `Watching ${user.watchTerms.length} trend term(s): ${user.watchTerms.map((t) => t.term).join(", ")}`
        : "No trend terms tracked",
    ].join("\n");

    let report: string;
    try {
      const res = await claude().messages.create({
        model: CLAUDE_MODELS.fast,
        max_tokens: 600,
        system:
          "You are Fortify, the AI co-pilot for the Fortune Fortress community. Write weekly strategy reports. Be direct, sharp, and useful. No emojis. No buzzwords. Max 500 words.",
        messages: [
          {
            role: "user",
            content: `Write a weekly strategy report for a ${user.tier} member named ${user.name ?? "this member"}.

Their activity this week:
${activitySummary}

Include:
1. A one-line summary of their week
2. One concrete action they should take next week based on their usage
3. One underused Fortify feature they should try given their tier

Keep it tight. Under 300 words.`,
          },
        ],
      });
      report =
        res.content[0].type === "text"
          ? res.content[0].text
          : "Could not generate report.";
    } catch {
      continue;
    }

    const message = `**Your weekly Fortify report**\n\n${report}\n\nDashboard: https://fortify-io.com/dashboard`;

    await sendDMConditional(user.discordId, user.id, "dmWeeklyReport", message);
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
