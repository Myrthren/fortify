import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ notifications });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const body = await req.json();
  if (body.all) {
    await db.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  } else if (body.ids?.length) {
    await db.notification.updateMany({ where: { userId, id: { in: body.ids } }, data: { read: true } });
  }
  return NextResponse.json({ ok: true });
}
