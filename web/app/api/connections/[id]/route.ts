import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ConnectionStatus } from "@prisma/client";

// PATCH — accept or decline
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const conn = await db.userConnection.findUnique({ where: { id } });
  if (!conn || conn.toUserId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status } = await req.json();
  if (!["ACCEPTED", "DECLINED"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  await db.userConnection.update({ where: { id }, data: { status: status as ConnectionStatus } });

  // Notify the requester when their request is accepted
  if (status === "ACCEPTED") {
    try {
      const accepter = await db.user.findUnique({ where: { id: userId }, select: { username: true, name: true } });
      const accepterName = accepter?.username ? `@${accepter.username}` : (accepter?.name ?? "Someone");
      await db.notification.create({
        data: {
          userId: conn.fromUserId,
          type: "connection_accepted",
          title: `${accepterName} accepted your connection request`,
          link: "/dashboard/connections",
        },
      });
    } catch {}
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove connection
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const conn = await db.userConnection.findUnique({ where: { id } });
  if (!conn || (conn.fromUserId !== userId && conn.toUserId !== userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.userConnection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
