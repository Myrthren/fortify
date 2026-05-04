import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { braveSearch } from "@/lib/brave";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

export type ReviewReport = {
  sentiment: "positive" | "mixed" | "negative";
  topComplaints: string[];
  topPraises: string[];
  opportunities: string[];
  summary: string;
};

/**
 * POST /api/competitors/[id]/reviews
 * Scrapes review snippets via Brave, Claude extracts sentiment + positioning opportunities.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (TIER_LIMITS[user.tier].competitors === 0) {
    return NextResponse.json(
      { error: "Competitor Scanner is a Pro+ feature.", upgrade: true },
      { status: 403 }
    );
  }

  const { id } = await params;
  const competitor = await db.competitor.findUnique({ where: { id } });
  if (!competitor || competitor.userId !== userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const [g2, trustpilot, general] = await Promise.all([
      braveSearch({ query: `"${competitor.name}" reviews site:g2.com`, count: 5 }).catch(() => []),
      braveSearch({ query: `"${competitor.name}" reviews site:trustpilot.com`, count: 5 }).catch(() => []),
      braveSearch({ query: `"${competitor.name}" customer reviews complaints`, count: 8, freshness: "py" }).catch(() => []),
    ]);

    const allResults = [...g2, ...trustpilot, ...general];
    if (!allResults.length) {
      return NextResponse.json({ error: "No review data found for this competitor." }, { status: 404 });
    }

    const snippets = allResults
      .map((r) => `Source: ${r.source ?? r.url}\n"${r.title}"\n${r.description}`)
      .join("\n\n");

    const msg = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `You are a competitive intelligence analyst. Analyse these review snippets for "${competitor.name}" and extract actionable intelligence.

Review data:
${snippets.slice(0, 6000)}

Return ONLY a JSON object:
{
  "sentiment": "positive" | "mixed" | "negative",
  "topComplaints": ["specific complaint", "..."],  // 3-5 items, concrete and specific
  "topPraises": ["specific praise", "..."],         // 2-4 items
  "opportunities": ["positioning angle against this weakness", "..."],  // 3-4 items, actionable for a competitor
  "summary": "2-3 sentence bottom line on how customers actually feel about this product."
}`,
        },
      ],
    });

    const raw = (msg.content[0] as any).text as string;
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const report: ReviewReport = JSON.parse(cleaned);

    const updated = await db.competitor.update({
      where: { id },
      data: { reviewReport: report as any, reviewScannedAt: new Date() },
    });

    return NextResponse.json({ report, reviewScannedAt: updated.reviewScannedAt });
  } catch (e: any) {
    console.error("[competitor reviews]", e);
    return new NextResponse(`Review scan failed: ${e.message}`, { status: 500 });
  }
}
