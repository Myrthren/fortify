import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { findMatches } from "@/lib/matchmaking";
import { logGeneration } from "@/lib/usage";

export async function POST() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const me = await db.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!me) return new NextResponse("Not found", { status: 404 });

  // Pro+ feature
  if (me.tier === "FREE") {
    return NextResponse.json(
      {
        error: "AI Matchmaking is a Pro+ feature. Upgrade to find your matches.",
        upgrade: true,
      },
      { status: 403 }
    );
  }

  // Need a profile with at least niche or some skills
  if (!me.profile || (!me.profile.niche && me.profile.skills.length === 0)) {
    return NextResponse.json(
      {
        error: "Add niche or skills to your profile first so we can match you.",
      },
      { status: 400 }
    );
  }

  // Pull all other members with non-empty profiles
  const candidates = await db.user.findMany({
    where: {
      id: { not: userId },
      profile: {
        OR: [{ niche: { not: null } }, { skills: { isEmpty: false } }],
      },
    },
    include: { profile: true },
    take: 200,
  });

  if (candidates.length === 0) {
    return NextResponse.json({
      matches: [],
      empty:
        "No other members with profiles yet. Invite founders to join — matchmaking gets smarter with more people.",
    });
  }

  try {
    const matches = await findMatches({
      me: {
        id: me.id,
        name: me.name ?? "Member",
        niche: me.profile.niche,
        skills: me.profile.skills,
        lookingFor: me.profile.lookingFor,
        canOffer: me.profile.canOffer,
      },
      candidates: candidates.map((c) => ({
        id: c.id,
        name: c.name ?? "Member",
        niche: c.profile?.niche ?? null,
        skills: c.profile?.skills ?? [],
        lookingFor: c.profile?.lookingFor ?? [],
        canOffer: c.profile?.canOffer ?? [],
      })),
      topN: 5,
    });

    await logGeneration({
      userId: me.id,
      type: "match",
      input: `${candidates.length} candidates`,
      output: JSON.stringify(matches),
    });

    // Hydrate with member display info (paid users see contact info)
    const idToMember = new Map(candidates.map((c) => [c.id, c]));
    const isPaid = me.tier !== "FREE";
    const hydrated = matches
      .map((m) => {
        const c = idToMember.get(m.userId);
        if (!c) return null;
        return {
          ...m,
          name: c.name ?? "Member",
          image: c.image,
          tier: c.tier,
          niche: c.profile?.niche ?? null,
          socials: isPaid ? ((c.profile?.socials as Record<string, string>) ?? null) : null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ matches: hydrated });
  } catch (e: any) {
    console.error("[match]", e);
    return new NextResponse(`Match failed: ${e.message}`, { status: 500 });
  }
}
