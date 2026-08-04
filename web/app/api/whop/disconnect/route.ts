import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  // Unlink the Whop identity. Tier is left alone — removing access is the
  // reconcile job's call, not an accidental click's.
  await db.user.update({ where: { id: userId }, data: { whopUserId: null } });

  const sub = await db.subscription.findUnique({ where: { userId } });
  if (sub?.provider === "whop") {
    await db.subscription.update({
      where: { userId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
