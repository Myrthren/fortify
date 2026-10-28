import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { saveSitePulse } from "@/lib/site-pulse";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const latest = await db.sitePulse.findFirst({ where: { userId }, orderBy: { checkedAt: "desc" } });
  return NextResponse.json({ pulse: latest ? { ...latest, checkedAt: latest.checkedAt.toISOString() } : null });
}

export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const business = await db.businessProfile.findFirst({ where: { userId, active: true }, select: { id: true, website: true } });
  if (!business?.website) return NextResponse.json({ error: "Add a public website to your active business before running Website Pulse." }, { status: 400 });
  try {
    const saved = await saveSitePulse(userId, { id: business.id, website: business.website });
    return NextResponse.json({ pulse: { ...saved, checkedAt: saved.checkedAt.toISOString() } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Website check failed";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
