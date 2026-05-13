import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** POST /api/meta/disconnect — removes the user's MetaConnection. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  await db.metaConnection.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
