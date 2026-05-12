import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { startRunAndWait, getDatasetItems } from "@/lib/apify";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

// Allow up to 55 s — Apify waitForFinish=50 + buffer (Netlify Pro: 60 s max)
export const maxDuration = 55;

// Fields returned by trudax/reddit-scraper-lite
type RedditPost = {
  title: string;
  url: string;
  score: number;
  numberOfComments: number;
  subreddit: string;
  body?: string;
};

type InspirationPost = {
  hook: string;
  angle: string;
  format: string;
  source: { title: string; url: string; score: number };
};

/**
 * POST /api/inspiration/posts
 * Body: { niche: string }
 * Scrapes top Reddit posts in the niche, extracts hook patterns via Claude.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (!TIER_LIMITS[user.tier].contentInspiration) {
    return NextResponse.json(
      { error: "Content Inspiration is a Pro+ feature.", upgrade: true },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const niche = (body.niche ?? "").trim();
  if (!niche || niche.length < 2) {
    return NextResponse.json({ error: "Niche is required (min 2 chars)." }, { status: 400 });
  }

  try {
    // waitForFinish=50 blocks until the actor finishes (or 50s elapses) — no polling loop needed
    const runId = await startRunAndWait("reddit", {
      searches: [niche],
      sort: "top",
      time: "month",
      maxItems: 25,
      maxComments: 0,
    }, 50);

    const items = await getDatasetItems<RedditPost>(runId);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No Reddit posts found for that niche. Try a broader term." },
        { status: 422 }
      );
    }

    const top = items
      .slice(0, 20)
      .map((p) => `- "${p.title}" (${p.score} upvotes, r/${p.subreddit})`)
      .join("\n");

    const msg = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `You are a content strategist. Analyse these top Reddit posts about "${niche}" and extract 6 distinct content angles that clearly resonate with this audience. For each, give a hook, the underlying angle, and the best content format (e.g. listicle, story, hot take, tutorial, case study).

Posts:
${top}

Return ONLY a JSON array of 6 objects: [{ "hook": string, "angle": string, "format": string }]`,
        },
      ],
    });

    const raw = (msg.content[0] as any).text as string;
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Claude returned invalid JSON");
    const patterns: Omit<InspirationPost, "source">[] = JSON.parse(jsonMatch[0]);

    // Attach source post to each insight
    const results: InspirationPost[] = patterns.map((p, i) => ({
      ...p,
      source: {
        title: items[i]?.title ?? "",
        url: items[i]?.url ?? "",
        score: items[i]?.score ?? 0,
      },
    }));

    await db.generation.create({
      data: { userId, type: "inspiration-posts", input: niche, output: JSON.stringify(results) },
    });

    return NextResponse.json({ niche, results });
  } catch (e: any) {
    console.error("[inspiration/posts] failed", e);
    return new NextResponse(`Failed: ${e.message}`, { status: 500 });
  }
}
