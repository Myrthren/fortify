import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripeData } from "@/lib/stripe-intel";
import { sendDMConditional } from "@/lib/notifications";

const DROP_THRESHOLD = 0.10; // alert if MRR drops more than 10%
const SPIKE_THRESHOLD = 0.25; // alert if MRR rises more than 25%

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const users = await db.user.findMany({
    where: { discordId: { not: null }, stripeConnection: { isNot: null } },
    select: {
      id: true,
      discordId: true,
      stripeConnection: { select: { id: true, apiKey: true, lastMrr: true } },
    },
  });

  let alerted = 0;

  for (const user of users) {
    if (!user.discordId || !user.stripeConnection) continue;
    const { id: connId, apiKey, lastMrr } = user.stripeConnection;

    let data;
    try {
      data = await getStripeData(apiKey);
    } catch (e) {
      console.error(`[stripe-mrr-check] failed for ${user.id}:`, e);
      continue;
    }

    const currentMrr = data.mrr;

    // Always update lastMrr so next check has a baseline
    await db.stripeConnection.update({
      where: { id: connId },
      data: { lastMrr: currentMrr },
    });

    // Skip if no prior baseline
    if (lastMrr === 0) continue;

    const change = currentMrr - lastMrr;
    const changePct = change / lastMrr;

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: data.currency.toUpperCase(),
        maximumFractionDigits: 0,
      }).format(n);

    let message: string | null = null;

    if (changePct <= -DROP_THRESHOLD) {
      const pct = Math.round(Math.abs(changePct) * 100);
      message = [
        `**MRR drop alert**`,
        "",
        `Your MRR dropped **${pct}%** — from ${fmt(lastMrr)} to **${fmt(currentMrr)}** (${fmt(change)} this week).`,
        "",
        `Check your subscriptions: https://fortify-io.com/dashboard/revenue`,
      ].join("\n");
    } else if (changePct >= SPIKE_THRESHOLD) {
      const pct = Math.round(changePct * 100);
      message = [
        `**MRR spike — ${fmt(currentMrr)} 🔥**`,
        "",
        `Your MRR is up **${pct}%** this week — from ${fmt(lastMrr)} to **${fmt(currentMrr)}** (+${fmt(change)}).`,
        "",
        `https://fortify-io.com/dashboard/revenue`,
      ].join("\n");
    }

    if (!message) continue;

    await sendDMConditional(user.discordId, user.id, "dmStripeMrrDrop", message);
    alerted++;
  }

  return NextResponse.json({ ok: true, checked: users.length, alerted });
}
