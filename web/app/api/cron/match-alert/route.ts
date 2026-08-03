import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findMatches } from "@/lib/matchmaking";
import { sendDMConditional } from "@/lib/notifications";

/** Only surface genuinely strong fits — weak matches make the DM feel like spam. */
const MIN_SCORE = 75;

/**
 * POST /api/cron/match-alert
 * Weekly. For each PRO+ member with a usable profile, finds their best match
 * and DMs them about it — but only about people they haven't been told about
 * before, so a repeat run never re-sends the same person.
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
      profile: {
        OR: [{ niche: { not: null } }, { skills: { isEmpty: false } }],
      },
    },
    include: { profile: true },
  });

  let sent = 0;

  for (const me of users) {
    if (!me.discordId || !me.profile) continue;

    try {
      const alreadyTold = await db.matchNotification.findMany({
        where: { userId: me.id },
        select: { matchedId: true },
      });
      const excluded = new Set(alreadyTold.map((n) => n.matchedId));

      const candidates = await db.user.findMany({
        where: {
          id: { not: me.id },
          profile: {
            OR: [{ niche: { not: null } }, { skills: { isEmpty: false } }],
          },
        },
        include: { profile: true },
        take: 200,
      });

      const fresh = candidates.filter((c) => !excluded.has(c.id));
      if (fresh.length === 0) continue;

      const matches = await findMatches({
        me: {
          id: me.id,
          name: me.name ?? "Member",
          niche: me.profile.niche,
          skills: me.profile.skills,
          lookingFor: me.profile.lookingFor,
          canOffer: me.profile.canOffer,
        },
        candidates: fresh.map((c) => ({
          id: c.id,
          name: c.name ?? "Member",
          niche: c.profile?.niche ?? null,
          skills: c.profile?.skills ?? [],
          lookingFor: c.profile?.lookingFor ?? [],
          canOffer: c.profile?.canOffer ?? [],
        })),
        topN: 1,
      });

      const top = matches.find((m) => m.score >= MIN_SCORE);
      if (!top) continue;

      const matched = fresh.find((c) => c.id === top.userId);
      if (!matched) continue;

      // Record before sending so a DM failure can't cause a duplicate next run.
      await db.matchNotification.create({
        data: { userId: me.id, matchedId: matched.id },
      });

      await sendDMConditional(
        me.discordId,
        me.id,
        "dmMatchmaking",
        [
          `🤝 **New match found — ${matched.name ?? "a member"}** (${top.score}/100)`,
          "",
          top.why,
          "",
          `**They can help you:** ${top.theyHelpYou}`,
          `**You can help them:** ${top.youHelpThem}`,
          "",
          `**Opener:** ${top.starter}`,
          "",
          "See all your matches: https://fortify-io.com/dashboard/matchmaking",
        ].join("\n")
      );
      sent += 1;
    } catch (e) {
      console.error("[cron/match-alert] failed for user", me.id, e);
    }
  }

  return NextResponse.json({ ok: true, checked: users.length, sent });
}
