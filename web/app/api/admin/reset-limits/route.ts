import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";

export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !isOwner(user.discordId)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Delete AI sessions → fresh budget
  await db.aiSession.deleteMany({ where: { userId } });

  // Delete recent generations → resets monthly limits
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db.generation.deleteMany({
    where: { userId, createdAt: { gte: thirtyDaysAgo } },
  });

  // Restore credits to 99,999
  await db.user.update({
    where: { id: userId },
    data: { credits: 99999 },
  });

  return NextResponse.json({ ok: true });
}
