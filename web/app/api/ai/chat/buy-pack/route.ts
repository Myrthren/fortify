import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const PACKS = {
  1: { pricePounds: 4.99, budgetGbp: 2 },
  2: { pricePounds: 9.99, budgetGbp: 5 },
  3: { pricePounds: 24.99, budgetGbp: 15 },
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { pack, orderId } = await req.json();
  if (![1, 2, 3].includes(pack)) return NextResponse.json({ error: "Invalid pack" }, { status: 400 });

  const packDef = PACKS[pack as 1 | 2 | 3];

  const record = await db.aiCreditPack.create({
    data: { userId, pack, budgetGbp: packDef.budgetGbp, orderId: orderId ?? null },
  });

  return NextResponse.json({ ok: true, pack: record });
}
