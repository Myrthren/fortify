import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startRun, getRunStatus, getDatasetItems } from "@/lib/apify";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

const META_ADS_ACTOR = "UeNJ51UGugQ9Cwgtd"; // nourishing_courier/meta-ads-scraper-pro

type MetaAd = {
  adArchiveID?: string;
  snapshot?: {
    body?: { markup?: { __html?: string }; text?: string };
    cards?: { body?: string; cta_text?: string; title?: string }[];
    cta_text?: string;
    title?: string;
    link_url?: string;
    images?: unknown[];
    videos?: unknown[];
  };
  spend?: { lower_bound?: string; upper_bound?: string; currency?: string };
  impressions?: { lower_bound?: string; upper_bound?: string };
  publisher_platforms?: string[];
  start_date?: number;
  is_active?: boolean;
  page_name?: string;
};

// ── POST — start Apify run, return runId immediately ─────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const competitor = await db.competitor.findUnique({ where: { id } });
  if (!competitor || competitor.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Search by competitor name in Meta Ad Library
  let runId: string;
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error("APIFY_API_TOKEN not set");

    const res = await fetch(
      `https://api.apify.com/v2/acts/${META_ADS_ACTOR}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchQueries: [competitor.name],
          maxAds: 20,
          adStatus: "active",
          includeSpendData: true,
          includeCreativeDetails: true,
          includePageInsights: false,
        }),
      }
    );
    if (!res.ok) throw new Error(`Apify startRun failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    runId = json.data.id as string;
  } catch (e: any) {
    console.error("[scan-ads] startRun failed:", e);
    return NextResponse.json({ error: e.message ?? "Failed to start scan." }, { status: 502 });
  }

  return NextResponse.json({ runId });
}

// ── GET — poll Apify status, process report when done ────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const competitor = await db.competitor.findUnique({ where: { id } });
  if (!competitor || competitor.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

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

  // Fetch items
  let items: MetaAd[];
  try {
    items = await getDatasetItems<MetaAd>(runId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  if (!items.length) {
    return NextResponse.json({
      status: "failed",
      error: "No Meta ads found for this competitor. They may not be running Meta ads.",
    });
  }

  // Summarise for Claude
  const adSummaries = items.slice(0, 15).map((ad) => {
    const body =
      ad.snapshot?.body?.text ??
      ad.snapshot?.body?.markup?.__html?.replace(/<[^>]+>/g, "") ??
      ad.snapshot?.cards?.[0]?.body ??
      "";
    const cta = ad.snapshot?.cta_text ?? ad.snapshot?.cards?.[0]?.cta_text ?? "";
    const spend = ad.spend
      ? `$${ad.spend.lower_bound ?? "?"}–$${ad.spend.upper_bound ?? "?"}`
      : "unknown";
    const platforms = (ad.publisher_platforms ?? []).join(", ");
    return `AD: "${body.slice(0, 200)}" | CTA: "${cta}" | Spend: ${spend} | Platforms: ${platforms}`;
  }).join("\n");

  const msg = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a paid ads analyst. Analyse these Meta ads from competitor "${competitor.name}" and return ONLY valid JSON (no markdown) in this shape:
{
  "totalAds": number,
  "activeAds": number,
  "adAngles": ["string"],
  "topCtaPatterns": ["string"],
  "offerFrameworks": ["string"],
  "spendLevel": "string",
  "platforms": ["string"],
  "topAds": [{ "body": "string", "cta": "string", "spend": "string" }],
  "summary": "string"
}

Ads data (${items.length} ads found):
${adSummaries}`,
      },
    ],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();
  let report: unknown;
  try {
    report = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { report = JSON.parse(match[0]); } catch {
        return NextResponse.json({ status: "failed", error: "Claude returned invalid JSON" });
      }
    } else {
      return NextResponse.json({ status: "failed", error: "Claude returned invalid JSON" });
    }
  }

  await db.competitor.update({
    where: { id },
    data: { metaAdReport: report as any, metaAdScanAt: new Date() },
  });

  return NextResponse.json({ status: "succeeded", report });
}
