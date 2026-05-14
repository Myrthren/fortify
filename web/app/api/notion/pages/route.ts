import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessiblePages } from "@/lib/notion";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const conn = await db.notionConnection.findUnique({ where: { userId } });
  if (!conn) return NextResponse.json({ error: "Not connected" }, { status: 404 });

  try {
    const pages = await getAccessiblePages(conn.accessToken);
    return NextResponse.json({ pages });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { rootPageId } = await req.json();
  if (!rootPageId) return NextResponse.json({ error: "rootPageId required" }, { status: 400 });

  await db.notionConnection.update({ where: { userId }, data: { rootPageId } });
  return NextResponse.json({ ok: true });
}
