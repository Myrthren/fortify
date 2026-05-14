import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRevenueForPeriod } from "@/lib/shopify";
import { sendDMConditional } from "@/lib/notifications";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  const users = await db.user.findMany({
    where: { discordId: { not: null }, shopifyConnection: { isNot: null } },
    select: {
      id: true,
      discordId: true,
      shopifyConnection: { select: { shop: true, accessToken: true } },
    },
  });

  let sent = 0;

  for (const user of users) {
    if (!user.discordId || !user.shopifyConnection) continue;
    const { shop, accessToken } = user.shopifyConnection;

    let thisWeek, lastWeek;
    try {
      [thisWeek, lastWeek] = await Promise.all([
        getRevenueForPeriod(shop, accessToken, weekAgo, now),
        getRevenueForPeriod(shop, accessToken, twoWeeksAgo, weekAgo),
      ]);
    } catch (e) {
      console.error(`[shopify-weekly-revenue] failed for ${user.id}:`, e);
      continue;
    }

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: thisWeek.currency.toUpperCase(),
        maximumFractionDigits: 0,
      }).format(n);

    const diff = thisWeek.revenue - lastWeek.revenue;
    const pct = lastWeek.revenue > 0
      ? Math.round((diff / lastWeek.revenue) * 100)
      : null;

    const trend =
      pct === null ? "" :
      pct > 0 ? ` ↑ ${pct}% vs last week` :
      pct < 0 ? ` ↓ ${Math.abs(pct)}% vs last week` :
      " — flat vs last week";

    const message = [
      `**Weekly Shopify summary — ${shop}**`,
      "",
      `Revenue (last 7 days): **${fmt(thisWeek.revenue)}**${trend}`,
      `Orders: **${thisWeek.orderCount}**`,
      lastWeek.revenue > 0 ? `Previous 7 days: ${fmt(lastWeek.revenue)} (${lastWeek.orderCount} orders)` : "",
      "",
      `Full dashboard: https://fortify-io.com/dashboard/shopify`,
    ].filter(Boolean).join("\n");

    await sendDMConditional(user.discordId, user.id, "dmShopifyWeeklyRevenue", message);
    sent++;
  }

  return NextResponse.json({ ok: true, checked: users.length, sent });
}
