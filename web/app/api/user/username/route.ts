import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// PUT — set/change username
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const { username } = await req.json();
  const clean = username?.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!clean || clean.length < 3 || clean.length > 20) {
    return NextResponse.json({ error: "Username must be 3-20 characters (letters, numbers, underscore only)" }, { status: 400 });
  }

  // Check if taken
  const existing = await db.user.findFirst({ where: { username: clean, NOT: { id: userId } } });
  if (existing) return NextResponse.json({ error: "Username already taken" }, { status: 409 });

  // First change is free, subsequent cost 1000 credits
  const isFree = user.usernameChangesUsed === 0 || user.username === null;

  if (!isFree) {
    if (user.credits < 1000) {
      return NextResponse.json({ error: "Username changes after the first cost 1000 credits. You don't have enough." }, { status: 402 });
    }
    await db.user.update({
      where: { id: userId },
      data: {
        username: clean,
        usernameChangesUsed: { increment: 1 },
        credits: { decrement: 1000 },
      },
    });
    await db.creditTransaction.create({
      data: { userId, amount: -1000, source: "username_change" },
    });
  } else {
    await db.user.update({
      where: { id: userId },
      data: { username: clean, usernameChangesUsed: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true, username: clean });
}
