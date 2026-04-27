import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const competitors = await db.competitor.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ competitors });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const limit = TIER_LIMITS[user.tier].competitors;
  const count = await db.competitor.count({ where: { userId } });
  if (count >= limit) {
    return NextResponse.json(
      {
        error:
          limit === 0
            ? "Competitor Scanner is a Pro+ feature. Upgrade to start tracking."
            : `Competitor limit reached (${limit}). Delete one or upgrade.`,
        upgrade: true,
      },
      { status: limit === 0 ? 403 : 429 }
    );
  }

  const { name, url } = (await req.json()) as { name?: string; url?: string };
  const cleanName = name?.trim().slice(0, 80);
  let cleanUrl = url?.trim().slice(0, 300);

  if (!cleanName || cleanName.length < 1) {
    return new NextResponse("Name is required", { status: 400 });
  }
  if (!cleanUrl || cleanUrl.length < 4) {
    return new NextResponse("URL is required", { status: 400 });
  }
  if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = "https://" + cleanUrl;

  const created = await db.competitor.create({
    data: { userId, name: cleanName, url: cleanUrl },
  });
  return NextResponse.json({ competitor: created });
}
