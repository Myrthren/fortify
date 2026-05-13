import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { verifyShopifyCredentials } from "@/lib/shopify";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => ({}));
  const shop = (body.shop ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const accessToken = (body.accessToken ?? "").trim();

  if (!shop || !accessToken) {
    return NextResponse.json({ error: "shop and accessToken required" }, { status: 400 });
  }

  try {
    const shopName = await verifyShopifyCredentials(shop, accessToken);
    await db.shopifyConnection.upsert({
      where: { userId },
      create: { userId, shop, accessToken },
      update: { shop, accessToken },
    });
    return NextResponse.json({ ok: true, shopName, shop });
  } catch (e: any) {
    return NextResponse.json({ error: `Invalid credentials: ${e.message}` }, { status: 400 });
  }
}
