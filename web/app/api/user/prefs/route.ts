import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const ALLOWED = ["showDiscordUsername", "allowMessages", "allowConnections"] as const;

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json();
  const updates: Record<string, boolean> = {};

  for (const key of ALLOWED) {
    if (typeof body[key] === "boolean") updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  await db.user.update({ where: { id: userId }, data: updates });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { showDiscordUsername: true, allowMessages: true, allowConnections: true, username: true, usernameChangesUsed: true, credits: true },
  });
  return NextResponse.json(user ?? {});
}
