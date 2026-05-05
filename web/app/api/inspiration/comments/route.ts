import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { startRun, getRunStatus, getDatasetItems } from "@/lib/apify";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

// Fields returned by streamers/youtube-scraper (search mode)
type YTVideo = {
  title?: string;
  description?: string;
  url?: string;
  viewCount?: number;
  views?: number;       // scraper may use either field name
  duration?: string;
  channelName?: string;
  channel?: string;
};

type CommentInsight = {
  painPoint: string;
  desire: string;
  contentAngle: string;
  evidence: string;
};

/**
 * POST /api/inspiration/comments
 * Body: { niche: string }
 * Scrapes top YouTube videos in the niche, extracts audience pain points via Claude.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (!TIER_LIMITS[user.tier].ytCommentIntel) {
    return NextResponse.json(
      { error: "YouTube Comment Intel is an Elite+ feature.", upgrade: true },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const niche = (body.niche ?? "").trim();
  if (!niche || niche.length < 2) {
    return NextResponse.json({ error: "Niche is required (min 2 chars)." }, { status: 400 });
  }

  try {
    // youtube-scraper: use searches + videosSearch:true for keyword search mode
    const runId = await startRun("youtube", {
      searches: [`${niche} tips questions`],
      videosSearch: true,
      maxResults: 12,
    });

    const deadline = Date.now() + 90_000;
    let status = "RUNNING";
    while (status === "RUNNING" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      status = await getRunStatus(runId);
    }

    if (status !== "SUCCEEDED") {
      return new NextResponse(`Apify run ${status}`, { status: 500 });
    }

    const items = await getDatasetItems<YTVideo>(runId);
    const videoData = items
      .slice(0, 10)
      .map((v) => {
        const desc = (v.description ?? "").slice(0, 300);
        const views = v.viewCount ?? v.views ?? "?";
        return `Title: "${v.title}" | Views: ${views} | Description: ${desc}`;
      })
      .join("\n\n");

    const msg = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 1400,
      messages: [
        {
          role: "user",
          content: `You are an audience research analyst. Based on the top YouTube videos about "${niche}" below, infer 6 distinct pain points or desires the audience is expressing. For each, name the pain point, the underlying desire, the best content angle to address it, and a short evidence quote from the video data.

Video data:
${videoData}

Return ONLY a JSON array of 6 objects: [{ "painPoint": string, "desire": string, "contentAngle": string, "evidence": string }]`,
        },
      ],
    });

    const raw = (msg.content[0] as any).text as string;
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Claude returned invalid JSON");
    const insights: CommentInsight[] = JSON.parse(jsonMatch[0]);

    await db.generation.create({
      data: { userId, type: "inspiration-comments", input: niche, output: JSON.stringify(insights) },
    });

    return NextResponse.json({ niche, insights });
  } catch (e: any) {
    console.error("[inspiration/comments] failed", e);
    return new NextResponse(`Failed: ${e.message}`, { status: 500 });
  }
}
