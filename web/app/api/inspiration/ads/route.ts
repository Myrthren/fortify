import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { getRunStatus, getDatasetItems } from "@/lib/apify";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

const META_ADS_ACTOR = "UeNJ51UGugQ9Cwgtd"; // nourishing_courier/meta-ads-scraper-pro

type MetaAd = {
  snapshot?: {
    body?: { text?: string; markup?: { __html?: string } };
    cards?: { body?: string; cta_text?: string }[];
    cta_text?: string;
    images?: unknown[];
    videos?: unknown[];
  };
  spend?: { lower_bound?: string; upper_bound?: string };
  publisher_platforms?: string[];
  page_name?: string;
};

type AdInsight = {
  hook: string;
  angle: string;
  ctaPattern: string;
  format: string;
  spendSignal: string;
};

/**
 * POST /api/inspiration/ads
 * Body: { niche: string }
 * Starts an Apify Meta Ads Library scrape for the niche keyword.
 * Returns { runId } immediately — client polls GET with ?runId=xxx
 *
 * GET /api/inspiration/ads?runId=xxx
 * Polls Apify, processes with Claude, returns insights.
 */

// ── POST — start run ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (!TIER_LIMITS[user.tier].ytCommentIntel) {
    // Reuse ytCommentIntel gate — Ad Intel is Elite+
    return NextResponse.json(
      { error: "Ad Intelligence is an Elite+ feature.", upgrade: true },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const niche = (body.niche ?? "").trim();
  if (!niche || niche.length < 2) {
    return NextResponse.json({ error: "Niche is required (min 2 chars)." }, { status: 400 });
  }

  const token = process.env.APIFY_API_TOKEN;
  if (!token) return new NextResponse("APIFY_API_TOKEN not set", { status: 500 });

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${META_ADS_ACTOR}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchQueries: [niche],
          maxAds: 20,
          adStatus: "active",
          includeSpendData: true,
          includeCreativeDetails: true,
          includePageInsights: false,
        }),
      }
    );
    if (!res.ok) throw new Error(`Apify start failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const runId = json.data.id as string;
    return NextResponse.json({ runId });
  } catch (e: any) {
    console.error("[inspiration/ads] startRun failed:", e);
    return new NextResponse(`Failed: ${e.message}`, { status: 500 });
  }
}

// ── GET — poll + process ──────────────────────────────────────────────────────

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  const niche = searchParams.get("niche") ?? "";
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

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

  let items: MetaAd[];
  try {
    items = await getDatasetItems<MetaAd>(runId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  if (!items.length) {
    return NextResponse.json({
      status: "failed",
      error: "No active Meta ads found for that niche. Try a broader term.",
    });
  }

  const adSummaries = items.slice(0, 15).map((ad) => {
    const body =
      ad.snapshot?.body?.text ??
      ad.snapshot?.body?.markup?.__html?.replace(/<[^>]+>/g, "") ??
      ad.snapshot?.cards?.[0]?.body ??
      "";
    const cta = ad.snapshot?.cta_text ?? ad.snapshot?.cards?.[0]?.cta_text ?? "";
    const spend = ad.spend
      ? `$${ad.spend.lower_bound ?? "?"}–$${ad.spend.upper_bound ?? "?"}`
      : "?";
    const hasVideo = (ad.snapshot?.videos?.length ?? 0) > 0;
    return `"${body.slice(0, 200)}" | CTA: "${cta}" | Spend: ${spend} | Format: ${hasVideo ? "video" : "image"}`;
  }).join("\n");

  const msg = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1400,
    messages: [
      {
        role: "user",
        content: `You are a paid ads strategist. Analyse these currently-running Meta ads about "${niche}" and extract 6 distinct ad frameworks that are clearly working (ads with spend signal indicate longevity). For each extract the hook, the underlying angle, the CTA pattern, the best ad format, and a spend signal (High/Medium/Low based on spend range).

Ads:
${adSummaries}

Return ONLY a JSON array of 6 objects: [{ "hook": string, "angle": string, "ctaPattern": string, "format": string, "spendSignal": string }]`,
      },
    ],
  });

  const raw = (msg.content[0] as any).text as string;
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ status: "failed", error: "Claude returned invalid JSON" });
  }
  let insights: AdInsight[];
  try {
    insights = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ status: "failed", error: "Claude returned invalid JSON" });
  }

  await db.generation.create({
    data: { userId, type: "inspiration-ads", input: niche, output: JSON.stringify(insights) },
  });

  return NextResponse.json({ status: "succeeded", niche, insights });
}
