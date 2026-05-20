import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";

async function guard() {
  const session = await auth();
  if (!session?.user) return null;
  const user = await db.user.findUnique({ where: { id: (session.user as any).id }, select: { discordId: true } });
  if (!user || !isOwner(user.discordId)) return null;
  return true;
}

/** GET — list all pods with members */
export async function GET() {
  if (!await guard()) return new NextResponse("Unauthorized", { status: 401 });

  const pods = await db.pod.findMany({
    include: {
      members: {
        include: {
          user: { select: { id: true, email: true, username: true, tier: true, discordId: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pods });
}

/** POST — create a pod or add/remove a member */
export async function POST(req: Request) {
  if (!await guard()) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { name } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const pod = await db.pod.create({ data: { name: name.trim() } });
    return NextResponse.json({ pod });
  }

  if (action === "add_member") {
    const { podId, userId } = body;
    if (!podId || !userId) return NextResponse.json({ error: "podId + userId required" }, { status: 400 });
    // Ensure the user is APEX
    const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.tier !== "APEX") return NextResponse.json({ error: "User must be on Apex tier" }, { status: 400 });
    // Remove from any existing pod first
    await db.podMember.deleteMany({ where: { userId } });
    const member = await db.podMember.create({ data: { podId, userId } });
    return NextResponse.json({ member });
  }

  if (action === "remove_member") {
    const { podId, userId } = body;
    if (!podId || !userId) return NextResponse.json({ error: "podId + userId required" }, { status: 400 });
    await db.podMember.delete({ where: { podId_userId: { podId, userId } } });
    return NextResponse.json({ removed: true });
  }

  if (action === "delete_pod") {
    const { podId } = body;
    if (!podId) return NextResponse.json({ error: "podId required" }, { status: 400 });
    await db.pod.delete({ where: { id: podId } });
    return NextResponse.json({ deleted: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
