import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { braveSearch } from "@/lib/brave";

function ageHours(age?: string): number | null {
  const match = age?.toLowerCase().match(/(\d+)\s*(minute|hour|day|week|month|year)/);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2];
  return n * (unit.startsWith("minute") ? 1 / 60 : unit.startsWith("hour") ? 1 : unit.startsWith("day") ? 24 : unit.startsWith("week") ? 168 : unit.startsWith("month") ? 730 : 8760);
}

export function scoreTrend(term: string, result: { title: string; description: string; age?: string }) {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${result.title} ${result.description}`.toLowerCase();
  const matches = words.filter((word) => haystack.includes(word)).length;
  const relevance = words.length ? Math.round((matches / words.length) * 100) : 0;
  const hours = ageHours(result.age);
  const freshness = hours === null ? 35 : Math.max(5, Math.round(100 - Math.min(hours, 720) / 7.2));
  const opportunity = Math.round(relevance * 0.55 + freshness * 0.45);
  return { relevance, freshness, opportunity };
}

/**
 * Run Brave search for a specific watch term the user owns.
 * GET /api/trends/search?termId=xxx&freshness=pd
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (TIER_LIMITS[user.tier].watchTerms === 0) {
    return NextResponse.json(
      { error: "Trend Radar is a Pro+ feature.", upgrade: true },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const termId = url.searchParams.get("termId");
  const freshness = (url.searchParams.get("freshness") ?? "pw") as
    | "pd"
    | "pw"
    | "pm"
    | "py";

  if (!termId) return new NextResponse("termId required", { status: 400 });

  const term = await db.watchTerm.findUnique({ where: { id: termId } });
  if (!term || term.userId !== userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const results = await braveSearch({
      query: term.term,
      count: 10,
      freshness,
    });
    return NextResponse.json({ term: term.term, results: results.map((result) => ({ ...result, scores: scoreTrend(term.term, result) })) });
  } catch (e: any) {
    console.error("[trends] search failed", e);
    return new NextResponse(`Search failed: ${e.message}`, { status: 500 });
  }
}
