import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDMConditional } from "@/lib/notifications";

const DAYS = [1, 3, 7];

function nextStep(day: number, progress: { profile: boolean; dna: boolean; firstTool: boolean }) {
  if (!progress.profile) return "Complete your profile to get better member matches: https://fortify-io.com/dashboard/profile";
  if (!progress.dna) return "Add Company DNA so your AI results reflect your business: https://fortify-io.com/dashboard/company-dna";
  if (!progress.firstTool) return "Try your first tool on the dashboard. Start with a topic in Hook Generator: https://fortify-io.com/dashboard#hook-generator";
  return day === 7
    ? "You have your foundations in place. Explore the tools included in your tier: https://fortify-io.com/dashboard"
    : "Your first steps are done. Try Brand Voice or a Funnel Audit next: https://fortify-io.com/dashboard";
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  let sent = 0;

  for (const day of DAYS) {
    const windowStart = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000) - 12 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000) + 12 * 60 * 60 * 1000);

    const subs = await db.subscription.findMany({
      where: { status: "ACTIVE", startedAt: { gte: windowStart, lte: windowEnd } },
      include: { user: { include: { profile: true, companyDna: true } } },
    });

    for (const sub of subs) {
      if (!sub.user.discordId) continue;
      const firstGeneration = await db.generation.findFirst({ where: { userId: sub.userId }, select: { id: true } });
      const profile = sub.user.profile;
      const message = nextStep(day, {
        profile: !!profile && (!!profile.niche || profile.skills.length > 0 || profile.canOffer.length > 0),
        dna: (sub.user.companyDna?.totalChars ?? 0) > 0,
        firstTool: !!firstGeneration,
      });
      await sendDMConditional(sub.user.discordId, sub.userId, "dmOnboarding", `Fortify day ${day}: ${message}`);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
