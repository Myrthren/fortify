import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { braveSearch } from "@/lib/brave";

/**
 * POST /api/recon
 * Body: { location: string, category: string, filters?: unknown }
 * Requires ELITE or APEX tier. Costs 50 credits.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (user.tier !== "ELITE" && user.tier !== "APEX") {
    return NextResponse.json(
      { error: "Fortify Recon is an Elite and Apex feature.", upgrade: true },
      { status: 403 }
    );
  }

  if (user.credits < 50) {
    return NextResponse.json(
      { error: "Recon costs 50 credits. You don't have enough credits.", upgrade: true },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const location: string = (body.location ?? "").trim();
  const category: string = (body.category ?? "").trim();
  const filters = body.filters ?? null;

  if (!location) {
    return NextResponse.json({ error: "location is required." }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "category is required." }, { status: 400 });
  }

  const query = `${category} in ${location} contact`;

  try {
    const rawResults = await braveSearch({ query, count: 20 });

    const leads = rawResults.map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      source: r.source,
    }));

    // Deduct credits
    await db.user.update({
      where: { id: userId },
      data: { credits: { decrement: 50 } },
    });

    await db.creditTransaction.create({
      data: { userId, amount: -50, source: "spend_recon" },
    });

    // Persist search
    const reconSearch = await db.reconSearch.create({
      data: {
        userId,
        location,
        category,
        filters: filters ?? undefined,
        leads,
        totalLeads: leads.length,
      },
    });

    return NextResponse.json({
      searchId: reconSearch.id,
      leads,
      creditsUsed: 50,
    });
  } catch (e: any) {
    console.error("[recon] POST failed", e);
    return new NextResponse(`Recon search failed: ${e.message}`, { status: 500 });
  }
}

/**
 * GET /api/recon
 * Returns the user's 10 most recent recon searches.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const searches = await db.reconSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ searches });
}
