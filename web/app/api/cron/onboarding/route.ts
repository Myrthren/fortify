import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDMConditional } from "@/lib/notifications";

const DRIP: Record<number, string> = {
  1: "Welcome to Fortify. First move: set up your Brand Voice at https://fortify-io.com/dashboard/voice — it makes every tool 10x more personal.",
  3: "Day 3 check-in. Have you run a Funnel Audit yet? Paste any landing page URL at https://fortify-io.com/dashboard/audit and get a scored breakdown in 30 seconds.",
  7: "One week in. Competitor Scanner, Trend Radar, and AI Matchmaking are all live on your dashboard — most members don't touch them until month 2. Get ahead: https://fortify-io.com/dashboard",
};

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  let sent = 0;

  for (const [dayStr, message] of Object.entries(DRIP)) {
    const day = Number(dayStr);
    const windowStart = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000) - 12 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000) + 12 * 60 * 60 * 1000);

    const subs = await db.subscription.findMany({
      where: { status: "ACTIVE", startedAt: { gte: windowStart, lte: windowEnd } },
      include: { user: true },
    });

    for (const sub of subs) {
      if (!sub.user.discordId) continue;
      await sendDMConditional(sub.user.discordId, sub.userId, "dmOnboarding", message);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
