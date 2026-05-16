import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Tier } from "@prisma/client";
import { randomUUID } from "crypto";

const MEMORY_LIMITS: Record<Tier, number> = {
  FREE:  0,
  PRO:   30000,
  ELITE: 100000,
  APEX:  999999,
};

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const dna = await db.companyDna.findUnique({ where: { userId } });
  const limit = MEMORY_LIMITS[user.tier];

  return NextResponse.json({
    entries: (dna?.entries as any[]) ?? [],
    totalChars: dna?.totalChars ?? 0,
    limit,
    canUse: limit > 0,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const limit = MEMORY_LIMITS[user.tier];
  if (limit === 0) return NextResponse.json({ error: "Company DNA requires a Pro+ plan." }, { status: 403 });

  const { label, content } = await req.json();
  if (!label?.trim() || !content?.trim()) return NextResponse.json({ error: "label and content required" }, { status: 400 });

  const dna = await db.companyDna.findUnique({ where: { userId } });
  const entries: any[] = (dna?.entries as any[]) ?? [];
  const currentChars = dna?.totalChars ?? 0;
  const chars = (label + content).length;

  if (currentChars + chars > limit) {
    return NextResponse.json({ error: `Memory limit reached (${limit.toLocaleString()} chars). Free up space by removing entries.` }, { status: 429 });
  }

  const newEntry = {
    id: randomUUID(),
    label: label.trim(),
    content: content.trim(),
    chars,
    createdAt: new Date().toISOString(),
  };

  const newEntries = [...entries, newEntry];
  const newTotal = currentChars + chars;

  await db.companyDna.upsert({
    where: { userId },
    create: { userId, entries: newEntries, totalChars: newTotal },
    update: { entries: newEntries, totalChars: newTotal },
  });

  return NextResponse.json({ entry: newEntry, totalChars: newTotal });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { id } = await req.json();

  const dna = await db.companyDna.findUnique({ where: { userId } });
  if (!dna) return NextResponse.json({ ok: true });

  const entries: any[] = (dna.entries as any[]) ?? [];
  const newEntries = entries.filter((e: any) => e.id !== id);
  const newTotal = newEntries.reduce((sum: number, e: any) => sum + (e.chars ?? 0), 0);

  await db.companyDna.update({
    where: { userId },
    data: { entries: newEntries, totalChars: newTotal },
  });

  return NextResponse.json({ ok: true, totalChars: newTotal });
}
