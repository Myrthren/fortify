import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOutOfStockProducts } from "@/lib/shopify";
import { sendDMConditional } from "@/lib/notifications";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const users = await db.user.findMany({
    where: { discordId: { not: null }, shopifyConnection: { isNot: null } },
    select: {
      id: true,
      discordId: true,
      shopifyConnection: { select: { shop: true, accessToken: true } },
    },
  });

  let alerted = 0;

  for (const user of users) {
    if (!user.discordId || !user.shopifyConnection) continue;
    const { shop, accessToken } = user.shopifyConnection;

    let items;
    try {
      items = await getOutOfStockProducts(shop, accessToken);
    } catch (e) {
      console.error(`[shopify-out-of-stock] failed for ${user.id}:`, e);
      continue;
    }

    if (!items.length) continue;

    const lines = items
      .slice(0, 10)
      .map((item) => {
        const name = item.variant ? `${item.title} — ${item.variant}` : item.title;
        return `· **${name}** — out of stock`;
      });

    const message = [
      `**Out of stock alert — ${shop}**`,
      "",
      `${items.length} product${items.length !== 1 ? "s" : ""} currently out of stock:`,
      "",
      ...lines,
      ...(items.length > 10 ? [`…and ${items.length - 10} more`] : []),
      "",
      `Restock now: https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/products`,
    ].join("\n");

    await sendDMConditional(user.discordId, user.id, "dmShopifyOutOfStock", message);
    alerted++;
  }

  return NextResponse.json({ ok: true, checked: users.length, alerted });
}
