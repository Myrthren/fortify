import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { startRun, getRunStatus, getDatasetItems } from "@/lib/apify";

// Fields returned by trudax/reddit-scraper-lite
type RedditPost = {
  title: string;
  url: string;
  score: number;
  numberOfComments: number; // scraper returns "numberOfComments" not "numComments"
  subreddit: string;
  body?: string;
};

const FRESHNESS_TO_REDDIT: Record<string, string> = {
  pd: "day",
  pw: "week",
  pm: "month",
  py: "year",
};

/**
 * Run Reddit search for a watch term (ELITE+ only).
 * GET /api/trends/reddit?termId=xxx&freshness=pw
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const limits = TIER_LIMITS[user.tier];
  if (!limits.redditTrends) {
    return NextResponse.json(
      { error: "Reddit signals are an Elite+ feature.", upgrade: true },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const termId = url.searchParams.get("termId");
  const freshness = url.searchParams.get("freshness") ?? "pw";

  if (!termId) return new NextResponse("termId required", { status: 400 });

  const term = await db.watchTerm.findUnique({ where: { id: termId } });
  if (!term || term.userId !== userId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const timeFilter = FRESHNESS_TO_REDDIT[freshness] ?? "week";

  try {
    const runId = await startRun("reddit", {
      searches: [term.term],
      sort: "top",
      time: timeFilter,
      maxItems: 20,
      maxPostCount: 20,
      maxComments: 0,
    });

    // Poll until done (max 60s)
    const deadline = Date.now() + 60_000;
    let status = "RUNNING";
    while (status === "RUNNING" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      status = await getRunStatus(runId);
    }

    if (status !== "SUCCEEDED") {
      return new NextResponse(`Apify run ${status}`, { status: 500 });
    }

    const items = await getDatasetItems<RedditPost>(runId);
    const posts = items.slice(0, 15).map((p) => ({
      title: p.title,
      url: p.url,
      score: p.score ?? 0,
      numComments: p.numberOfComments ?? 0,
      subreddit: p.subreddit ?? "",
    }));

    return NextResponse.json({ term: term.term, posts });
  } catch (e: any) {
    console.error("[trends/reddit] failed", e);
    return new NextResponse(`Reddit search failed: ${e.message}`, { status: 500 });
  }
}
