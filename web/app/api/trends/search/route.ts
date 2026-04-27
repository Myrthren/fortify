import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { braveSearch } from "@/lib/brave";

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
      { error: "Trend Radar is an Elite+ feature.", upgrade: true },
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
    return NextResponse.json({ term: term.term, results });
  } catch (e: any) {
    console.error("[trends] search failed", e);
    return new NextResponse(`Search failed: ${e.message}`, { status: 500 });
  }
}
