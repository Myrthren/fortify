import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLowStockProducts } from "@/lib/shopify";
import { sendDMConditional } from "@/lib/notifications";

const LOW_STOCK_THRESHOLD = 5;

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Find all users with Shopify connected and a Discord ID
  const users = await db.user.findMany({
    where: {
      discordId: { not: null },
      shopifyConnection: { isNot: null },
    },
    select: {
      id: true,
      discordId: true,
      shopifyConnection: { select: { shop: true, accessToken: true } },
    },
  });

  let alerted = 0;
  let errors = 0;

  for (const user of users) {
    if (!user.discordId || !user.shopifyConnection) continue;

    const { shop, accessToken } = user.shopifyConnection;

    let lowItems;
    try {
      lowItems = await getLowStockProducts(shop, accessToken, LOW_STOCK_THRESHOLD);
    } catch (e) {
      console.error(`[shopify-stock-check] Failed for user ${user.id}:`, e);
      errors++;
      continue;
    }

    if (lowItems.length === 0) continue;

    // Format the DM
    const lines = lowItems
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 10) // cap at 10 items per alert
      .map((item) => {
        const name = item.variant ? `${item.title} — ${item.variant}` : item.title;
        return `· **${name}** — ${item.quantity} left`;
      });

    const message = [
      `**Low stock alert — ${shop}**`,
      "",
      `${lowItems.length} product${lowItems.length !== 1 ? "s" : ""} running low (≤ ${LOW_STOCK_THRESHOLD} units):`,
      "",
      ...lines,
      ...(lowItems.length > 10 ? [`…and ${lowItems.length - 10} more`] : []),
      "",
      `View your store: https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}`,
      `Fortify dashboard: https://fortify-io.com/dashboard/shopify`,
    ].join("\n");

    await sendDMConditional(user.discordId, user.id, "dmShopifyLowStock", message);
    alerted++;
  }

  return NextResponse.json({ ok: true, checked: users.length, alerted, errors });
}
