import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startRun, getRunStatus, getDatasetItems } from "@/lib/apify";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

// ── POST — start SERP scan ────────────────────────────────────────────────────

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

  // Build search query from competitor name + domain
  const domain = competitor.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const queries = [competitor.name, domain];

  let runId: string;
  try {
    runId = await startRun("serp", {
      queries,
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      countryCode: "",
      languageCode: "",
    });
  } catch (e: any) {
    console.error("[scan-serp] startRun failed:", e);
    return NextResponse.json({ error: e.message ?? "Failed to start SERP scan." }, { status: 502 });
  }

  return NextResponse.json({ runId });
}

// ── GET — poll + process ──────────────────────────────────────────────────────

type SerpItem = {
  searchQuery?: { query?: string };
  organicResults?: { title?: string; url?: string; description?: string; position?: number }[];
  paidResults?: { title?: string; url?: string; description?: string }[];
  relatedQueries?: string[];
};

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

  let items: SerpItem[];
  try {
    items = await getDatasetItems<SerpItem>(runId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  if (!items.length) {
    return NextResponse.json({ status: "failed", error: "No SERP data returned." });
  }

  const dataStr = JSON.stringify(items, null, 2).slice(0, 14000);

  const msg = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `You are an SEO and competitive intelligence analyst. Analyse this Google SERP data for "${competitor.name}" and return ONLY valid JSON (no markdown):
{
  "organicPositions": [{ "position": number, "title": "string", "url": "string", "description": "string" }],
  "paidAds": [{ "title": "string", "url": "string", "description": "string" }],
  "relatedQueries": ["string"],
  "isRanking": boolean,
  "highestPosition": number | null,
  "totalAds": number,
  "opportunities": ["string"],
  "summary": "string"
}

Data:
${dataStr}`,
    }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();
  let report: unknown;
  try {
    report = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { report = JSON.parse(match[0]); }
      catch { return NextResponse.json({ status: "failed", error: "Claude returned invalid JSON" }); }
    } else {
      return NextResponse.json({ status: "failed", error: "Claude returned invalid JSON" });
    }
  }

  await db.competitor.update({
    where: { id },
    data: { serpReport: report as any, serpScanAt: new Date() },
  });

  return NextResponse.json({ status: "succeeded", report });
}
