import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startRun, getRunStatus, getDatasetItems, type Platform } from "@/lib/apify";
import Anthropic from "@anthropic-ai/sdk";

const SCAN_COST = 50; // credits per social scan

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── POST /api/competitors/[id]/scan-social ──────────────────────────────────
// Body: { platform: "youtube" | "tiktok", handle: string }
// Starts an Apify run, deducts 50 credits, returns { runId }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const body = await req.json() as { platform?: string; handle?: string };
  const platform = body.platform as Platform | undefined;
  const handle = (body.handle ?? "").trim().replace(/^@/, "");

  if (!platform || !["youtube", "tiktok"].includes(platform)) {
    return NextResponse.json({ error: "platform must be youtube or tiktok" }, { status: 400 });
  }
  if (!handle) {
    return NextResponse.json({ error: "handle required" }, { status: 400 });
  }

  // Check competitor belongs to user
  const competitor = await db.competitor.findUnique({ where: { id } });
  if (!competitor || competitor.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check credits
  const user = await db.user.findUnique({ where: { id: userId }, select: { credits: true } });
  if (!user || user.credits < SCAN_COST) {
    return NextResponse.json({ error: `Not enough credits. This scan costs ${SCAN_COST} credits.` }, { status: 402 });
  }

  // Build Apify input
  let input: Record<string, unknown>;
  if (platform === "youtube") {
    const url = handle.startsWith("http") ? handle : `https://www.youtube.com/@${handle}`;
    input = {
      startUrls: [{ url }],
      maxResults: 15,
    };
  } else {
    input = {
      profiles: [handle],
      resultsPerPage: 15,
      profileScrapeSections: ["videos"],
      profileSorting: "latest",
      shouldDownloadVideos: false,
      shouldDownloadSubtitles: false,
      excludePinnedPosts: false,
    };
  }

  // Start Apify run
  let runId: string;
  try {
    runId = await startRun(platform, input);
  } catch (e: any) {
    console.error("[scan-social] startRun failed:", e);
    return NextResponse.json({ error: "Failed to start scan. Try again." }, { status: 502 });
  }

  // Deduct credits atomically and save handle
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { decrement: SCAN_COST } },
    }),
    db.creditTransaction.create({
      data: { userId, amount: -SCAN_COST, source: `scan-social-${platform}` },
    }),
    db.competitor.update({
      where: { id },
      data: {
        [platform === "youtube" ? "youtubeHandle" : "tiktokHandle"]: handle,
      },
    }),
  ]);

  return NextResponse.json({ runId, platform });
}

// ── GET /api/competitors/[id]/scan-social?runId=xxx&platform=youtube ────────
// Polls Apify run status.
// When SUCCEEDED: fetches items, runs Claude analysis, saves report, returns report.
// Returns { status, report? }

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  const platform = searchParams.get("platform") as Platform | null;

  if (!runId || !platform) {
    return NextResponse.json({ error: "runId and platform required" }, { status: 400 });
  }

  // Auth check
  const competitor = await db.competitor.findUnique({ where: { id } });
  if (!competitor || competitor.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Poll Apify
  let status: string;
  try {
    status = await getRunStatus(runId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  if (status === "RUNNING" || status === "READY" || status === "CREATED") {
    return NextResponse.json({ status: "running" });
  }
  if (status !== "SUCCEEDED") {
    return NextResponse.json({ status: "failed", error: `Apify run ${status}` });
  }

  // Fetch dataset items
  let items: unknown[];
  try {
    items = await getDatasetItems(runId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  if (!items.length) {
    return NextResponse.json({ status: "failed", error: "No data returned. Check the handle is correct." });
  }

  // Build Claude prompt
  const truncated = items.slice(0, 15);
  const dataStr = JSON.stringify(truncated, null, 2).slice(0, 12000);

  const prompt = platform === "youtube"
    ? `You are a social media analyst. Analyse this YouTube channel data for competitor "${competitor.name}" and return ONLY valid JSON (no markdown, no prose) in this exact shape:
{
  "channelName": "string",
  "subscriberCount": "string",
  "postingFrequency": "string",
  "topTopics": ["string", "string", "string"],
  "contentStyle": "string",
  "topVideos": [{ "title": "string", "views": "string", "url": "string" }],
  "viralFormats": ["string"],
  "opportunities": ["string", "string", "string"],
  "summary": "string"
}

Data:
${dataStr}`
    : `You are a social media analyst. Analyse this TikTok profile data for competitor "${competitor.name}" and return ONLY valid JSON (no markdown, no prose) in this exact shape:
{
  "username": "string",
  "followerCount": "string",
  "postingFrequency": "string",
  "topTopics": ["string", "string", "string"],
  "contentStyle": "string",
  "topPosts": [{ "description": "string", "likes": "string", "url": "string" }],
  "viralFormats": ["string"],
  "opportunities": ["string", "string", "string"],
  "summary": "string"
}

Data:
${dataStr}`;

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();
  let report: unknown;
  try {
    report = JSON.parse(raw);
  } catch {
    // Try to extract JSON from markdown fences
    const match = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
    if (match) {
      report = JSON.parse(match[1]);
    } else {
      return NextResponse.json({ status: "failed", error: "Claude returned invalid JSON" });
    }
  }

  // Persist
  const now = new Date();
  if (platform === "youtube") {
    await db.competitor.update({
      where: { id },
      data: { youtubeReport: report as any, youtubeScanAt: now },
    });
  } else {
    await db.competitor.update({
      where: { id },
      data: { tiktokReport: report as any, tiktokScanAt: now },
    });
  }

  return NextResponse.json({ status: "succeeded", report });
}
