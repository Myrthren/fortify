import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRevenueForPeriod } from "@/lib/shopify";
import { sendDMConditional } from "@/lib/notifications";

// Monthly revenue milestones in USD-equivalent
const MILESTONES = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

function highestMilestoneCrossed(revenue: number): number | null {
  let highest: number | null = null;
  for (const m of MILESTONES) {
    if (revenue >= m) highest = m;
  }
  return highest;
}

function fmtMilestone(n: number): string {
  if (n >= 1000) return `$${n / 1000}k`;
  return `$${n}`;
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const users = await db.user.findMany({
    where: { discordId: { not: null }, shopifyConnection: { isNot: null } },
    select: {
      id: true,
      discordId: true,
      shopifyConnection: { select: { id: true, shop: true, accessToken: true, lastMilestoneAmount: true } },
    },
  });

  let alerted = 0;

  for (const user of users) {
    if (!user.discordId || !user.shopifyConnection) continue;
    const { id: connId, shop, accessToken, lastMilestoneAmount } = user.shopifyConnection;

    let period;
    try {
      period = await getRevenueForPeriod(shop, accessToken, startOfMonth, now);
    } catch (e) {
      console.error(`[shopify-milestone] failed for ${user.id}:`, e);
      continue;
    }

    const crossed = highestMilestoneCrossed(period.revenue);
    if (!crossed || crossed <= lastMilestoneAmount) continue;

    // New milestone crossed — update DB first (idempotent)
    await db.shopifyConnection.update({
      where: { id: connId },
      data: { lastMilestoneAmount: crossed },
    });

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: period.currency.toUpperCase(),
        maximumFractionDigits: 0,
      }).format(n);

    const message = [
      `🎯 **${fmtMilestone(crossed)} month crossed — ${shop}**`,
      "",
      `You've hit **${fmt(period.revenue)}** in revenue this month with ${period.orderCount} orders.`,
      "",
      `Keep going: https://fortify-io.com/dashboard/shopify`,
    ].join("\n");

    await sendDMConditional(user.discordId, user.id, "dmShopifyMilestone", message);
    alerted++;
  }

  return NextResponse.json({ ok: true, checked: users.length, alerted });
}
