import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getShopifyData } from "@/lib/shopify";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const requestedDays = Number(searchParams.get("days") ?? 30);
  const days = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(Math.floor(requestedDays), 365))
    : 30;

  const conn = await db.shopifyConnection.findUnique({ where: { userId } });
  if (!conn) return NextResponse.json({ error: "Not connected", notConnected: true }, { status: 404 });

  try {
    const data = await getShopifyData(conn.shop, conn.accessToken, days);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("[shopify/data]", e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
