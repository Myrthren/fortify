import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const terms = await db.watchTerm.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ terms });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const limit = TIER_LIMITS[user.tier].watchTerms;
  const count = await db.watchTerm.count({ where: { userId } });
  if (count >= limit) {
    return NextResponse.json(
      {
        error:
          limit === 0
            ? "Trend Radar is an Elite+ feature. Upgrade to track topics."
            : `Watch term limit reached (${limit}). Delete one or upgrade for more.`,
        upgrade: true,
      },
      { status: limit === 0 ? 403 : 429 }
    );
  }

  const { term } = (await req.json()) as { term?: string };
  const cleaned = term?.trim().slice(0, 80);
  if (!cleaned || cleaned.length < 2) {
    return new NextResponse("Term must be at least 2 chars", { status: 400 });
  }

  // De-dupe by user+term
  const existing = await db.watchTerm.findFirst({
    where: { userId, term: cleaned },
  });
  if (existing) {
    return NextResponse.json({ term: existing, deduped: true });
  }

  const created = await db.watchTerm.create({
    data: { userId, term: cleaned },
  });
  return NextResponse.json({ term: created });
}
