import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { platform } = await req.json();
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

  await db.socialConnection.deleteMany({ where: { userId, platform } });
  return NextResponse.json({ ok: true });
}
