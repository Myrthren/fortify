import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { braveSearch } from "@/lib/brave";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { sendDMConditional } from "@/lib/notifications";

/**
 * POST /api/cron/content-brief
 * Weekly. For each PRO+ user with a niche set on their profile,
 * pulls trending Reddit posts and DMs a "3 things to post this week" brief.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const users = await db.user.findMany({
    where: {
      tier: { in: ["PRO", "ELITE", "APEX"] },
      discordId: { not: null },
      profile: { niche: { not: null } },
    },
    select: {
      id: true,
      discordId: true,
      name: true,
      profile: { select: { niche: true } },
    },
  });

  let sent = 0;

  for (const user of users) {
    if (!user.discordId || !user.profile?.niche) continue;
    const niche = user.profile.niche;

    let posts;
    try {
      posts = await braveSearch({
        query: `site:reddit.com ${niche}`,
        count: 15,
        freshness: "pw", // past week
      });
    } catch (e) {
      console.error(`[content-brief] brave failed for ${user.id}:`, e);
      continue;
    }

    if (!posts.length) continue;

    const postsText = posts
      .map((p) => `- "${p.title}"\n  ${p.description ?? ""}`)
      .join("\n");

    let brief: string;
    try {
      const msg = await claude().messages.create({
        model: CLAUDE_MODELS.fast,
        max_tokens: 500,
        system:
          "You are Fortify, a content strategist for business owners. Be direct and sharp. No fluff. No emojis.",
        messages: [
          {
            role: "user",
            content: `Based on these trending Reddit posts about "${niche}" this week, give 3 specific content ideas for a business owner in this space.

For each idea:
- One-line hook they can use
- What angle makes it work right now
- Best format (thread, short-form video, newsletter, etc.)

Posts:
${postsText}

Keep the whole response under 280 words. Number the ideas 1, 2, 3.`,
          },
        ],
      });
      brief = (msg.content[0] as any).text as string;
    } catch (e) {
      console.error(`[content-brief] claude failed for ${user.id}:`, e);
      continue;
    }

    const message = [
      `**Your weekly content brief — ${niche}**`,
      "",
      brief.trim(),
      "",
      `More angles: https://fortify-io.com/dashboard/inspiration`,
    ].join("\n");

    await sendDMConditional(user.discordId, user.id, "dmContentBrief", message);
    sent++;
  }

  return NextResponse.json({ ok: true, checked: users.length, sent });
}
