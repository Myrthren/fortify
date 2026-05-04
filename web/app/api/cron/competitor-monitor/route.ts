import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { braveSearch } from "@/lib/brave";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { sendDMConditional } from "@/lib/notifications";

/**
 * POST /api/cron/competitor-monitor
 * Runs weekly. For each PRO+ user's competitors, searches for recent news.
 * If new moves detected, saves a change brief and sends a DM.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const users = await db.user.findMany({
    where: {
      tier: { in: ["PRO", "ELITE", "APEX"] },
      discordId: { not: null },
    },
    select: {
      id: true,
      discordId: true,
      competitors: {
        select: { id: true, name: true, url: true, lastReport: true },
      },
    },
  });

  let alerts = 0;

  for (const user of users) {
    for (const competitor of user.competitors) {
      try {
        const results = await braveSearch({
          query: `"${competitor.name}" news OR announcement OR update OR launch`,
          count: 8,
          freshness: "pw",
        });

        if (!results.length) continue;

        const snippets = results
          .map((r) => `- ${r.title} (${r.source ?? "?"}, ${r.age ?? "?"}): ${r.description}`)
          .join("\n");

        const existing = (competitor.lastReport as any)?.recentMoves as string[] | undefined;
        const existingStr = existing?.join("\n") ?? "(no prior moves on record)";

        const msg = await claude().messages.create({
          model: CLAUDE_MODELS.fast,
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `You monitor competitive intelligence. Here is what you previously knew about "${competitor.name}":
${existingStr}

New search results from this week:
${snippets}

Are there genuinely NEW developments (not already captured above)? If yes, list them as bullet points and write a 1-sentence "so what" brief. If nothing new, reply with exactly: NO_CHANGE

Format if changes found:
CHANGES:
- bullet 1
- bullet 2
BRIEF: one sentence on what this means for a competitor.`,
            },
          ],
        });

        const text = (msg.content[0] as any).text as string;
        if (text.trim() === "NO_CHANGE" || !text.includes("CHANGES:")) continue;

        const changesMatch = text.match(/CHANGES:\n([\s\S]*?)(?:BRIEF:|$)/);
        const briefMatch = text.match(/BRIEF:\s*(.+)/);
        const changes = (changesMatch?.[1] ?? "")
          .split("\n")
          .map((l) => l.replace(/^[-•]\s*/, "").trim())
          .filter(Boolean);
        const brief = briefMatch?.[1]?.trim() ?? "";

        await db.competitor.update({
          where: { id: competitor.id },
          data: {
            changeReport: { changes, brief } as any,
            changeDetectedAt: new Date(),
          },
        });

        if (user.discordId) {
          const changeList = changes.slice(0, 3).map((c) => `· ${c}`).join("\n");
          await sendDMConditional(
            user.discordId,
            user.id,
            "dmCompetitorDone",
            `**New activity detected: ${competitor.name}**\n${changeList}\n\n${brief}\n\nView your intel: https://fortify-io.com/dashboard/competitors`
          );
          alerts++;
        }
      } catch (e) {
        console.error(`[competitor-monitor] failed for ${competitor.name}:`, e);
      }
    }
  }

  return NextResponse.json({ ok: true, alerts });
}
