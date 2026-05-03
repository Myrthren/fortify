import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await db.user.findUnique({
    where: { id: (session.user as any).id },
    select: { discordId: true },
  });
  if (!me || !isOwner(me.discordId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, amount, note } = (await req.json()) as {
    userId?: string;
    amount?: number;
    note?: string;
  };

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!amount || typeof amount !== "number" || amount === 0) {
    return NextResponse.json({ error: "amount must be a non-zero number" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, credits: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Prevent going below 0
  if (target.credits + amount < 0) {
    return NextResponse.json(
      { error: `Cannot deduct ${Math.abs(amount)} — user only has ${target.credits} credits` },
      { status: 400 }
    );
  }

  const [updated] = await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
      select: { credits: true },
    }),
    db.creditTransaction.create({
      data: {
        userId,
        amount,
        source: `admin${note ? `:${note}` : ""}`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, newBalance: updated.credits });
}
