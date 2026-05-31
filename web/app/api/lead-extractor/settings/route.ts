import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";

/**
 * Owner-only Lead Extractor settings.
 * leRaiseBatch: lift the per-batch account cap for the owner.
 */

async function requireOwner() {
  const session = await auth();
  if (!session?.user) return null;
  const userId = (session.user as any).id;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, discordId: true, leRaiseBatch: true },
  });
  if (!user || !isOwner(user.discordId)) return null;
  return user;
}

export async function GET() {
  const user = await requireOwner();
  if (!user) return new NextResponse("Forbidden", { status: 403 });
  return NextResponse.json({ leRaiseBatch: user.leRaiseBatch ?? false });
}

export async function PATCH(req: Request) {
  const user = await requireOwner();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.leRaiseBatch !== "boolean")
    return NextResponse.json({ error: "leRaiseBatch (boolean) is required." }, { status: 400 });

  const updated = await db.user.update({
    where: { id: user.id },
    data: { leRaiseBatch: body.leRaiseBatch },
    select: { leRaiseBatch: true },
  });

  return NextResponse.json({ leRaiseBatch: updated.leRaiseBatch ?? false });
}
