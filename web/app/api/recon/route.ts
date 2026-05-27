import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { startRunAndWait, getDatasetItems } from "@/lib/apify";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Shape returned by compass~crawler-google-places
type GooglePlaceResult = {
  title?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  description?: string;
  totalScore?: number;
  reviewsCount?: number;
  categoryName?: string;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  emails?: string[];
};

async function scrapeEmails(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Strip scripts, styles, SVGs before matching to avoid false positives
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    return [
      ...new Set(
        (text.match(EMAIL_RE) ?? []).filter(
          (e) =>
            !e.endsWith(".png") &&
            !e.endsWith(".jpg") &&
            !e.endsWith(".gif") &&
            !e.includes("@2x") &&
            !e.includes("sentry") &&
            !e.includes("example")
        )
      ),
    ].slice(0, 5);
  } catch {
    return [];
  }
}

async function generateLeadContext(
  lead: { title: string; url: string; description: string },
  category: string,
  location: string
): Promise<string> {
  try {
    const msg = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: `Analyse this business lead for someone targeting ${category} businesses in ${location}.

Business: ${lead.title}
Website: ${lead.url}
Description: ${lead.description || "No description available"}

In 2-3 concise sentences, cover:
1. What this business likely needs right now
2. The best angle to approach them

Be specific and practical. No filler.`,
        },
      ],
    });
    return msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  } catch {
    return "";
  }
}

/**
 * POST /api/recon
 * Body: { location, category, count?, filters?, extractEmails?, applyContext? }
 * Requires ELITE or APEX tier. Base cost 50 credits.
 * +25 credits for extractEmails, +25 for applyContext.
 *
 * Uses Apify Google Maps scraper (compass~crawler-google-places) to return
 * real local business listings — not web search results.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const rl = rateLimit(`recon:${userId}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (user.tier !== "ELITE" && user.tier !== "APEX") {
    return NextResponse.json(
      { error: "Fortify Recon is an Elite and Apex feature.", upgrade: true },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const location: string = (body.location ?? "").trim();
  const category: string = (body.category ?? "").trim();
  const filters = body.filters ?? null;
  const extractEmails: boolean = body.extractEmails === true;
  const applyContext: boolean = body.applyContext === true;
  // Count: clamp between 5 and 50, default 10
  const count: number = Math.min(50, Math.max(5, Math.round(Number(body.count ?? 10))));

  if (!location) return NextResponse.json({ error: "location is required." }, { status: 400 });
  if (!category) return NextResponse.json({ error: "category is required." }, { status: 400 });

  // Credit cost — phones now come free from Google Maps, so no phone credit
  const baseCost = 50;
  const emailCost = extractEmails ? 25 : 0;
  const contextCost = applyContext ? 25 : 0;
  const totalCost = baseCost + emailCost + contextCost;

  if (user.credits < totalCost) {
    return NextResponse.json(
      { error: `This search costs ${totalCost} credits. You have ${user.credits}.`, upgrade: true },
      { status: 402 }
    );
  }

  try {
    // Run the Google Maps scraper and wait up to 110s for it to finish.
    // For 10–20 results this typically completes in 20–40s.
    // Larger counts (50) may take 60–100s.
    const runId = await startRunAndWait(
      "google-maps",
      {
        searchStringsArray: [`${category} ${location}`],
        maxCrawledPlacesPerSearch: count,
        language: "en",
        maxImages: 0,
        exportPlaceUrls: false,
        additionalInfo: false,
        maxReviews: 0,
        maxQuestions: 0,
        scrapeDirectories: false,
      },
      110
    );

    const rawResults = await getDatasetItems<GooglePlaceResult>(runId);

    type Lead = {
      title: string;
      url: string;
      description: string;
      phone?: string;
      address?: string;
      rating?: number;
      reviewsCount?: number;
      category?: string;
      emails?: string[];
      context?: string;
    };

    // Map Google Maps results to lead shape — skip permanently closed places
    let leads: Lead[] = rawResults
      .filter((r) => !r.permanentlyClosed && !r.temporarilyClosed && r.title)
      .slice(0, count)
      .map((r) => ({
        title: r.title ?? "",
        url: r.website ?? "",
        description: r.description ?? "",
        phone: r.phone ?? undefined,
        address: r.address ?? undefined,
        rating: r.totalScore ?? undefined,
        reviewsCount: r.reviewsCount ?? undefined,
        category: r.categoryName ?? undefined,
        // Google Maps sometimes provides emails directly
        emails: r.emails?.length ? r.emails : undefined,
      }));

    // Email scraping + AI context in parallel
    const [scrapedEmails, contextAll] = await Promise.all([
      extractEmails
        ? Promise.all(
            leads.map((lead) =>
              // Only scrape if Google Maps didn't already provide emails
              !lead.emails?.length && lead.url ? scrapeEmails(lead.url) : Promise.resolve(lead.emails ?? [])
            )
          )
        : Promise.resolve(null),
      applyContext
        ? Promise.all(leads.map((lead) => generateLeadContext(lead, category, location)))
        : Promise.resolve(null),
    ]);

    leads = leads.map((lead, i) => ({
      ...lead,
      emails: extractEmails && scrapedEmails ? scrapedEmails[i] : lead.emails,
      context: contextAll ? contextAll[i] : undefined,
    }));

    // Deduct credits
    await db.user.update({
      where: { id: userId },
      data: { credits: { decrement: totalCost } },
    });
    await db.creditTransaction.create({
      data: { userId, amount: -totalCost, source: "spend_recon" },
    });

    // Persist
    const reconSearch = await db.reconSearch.create({
      data: {
        userId,
        location,
        category,
        filters: filters ?? undefined,
        leads,
        totalLeads: leads.length,
      },
    });

    return NextResponse.json({
      searchId: reconSearch.id,
      leads,
      creditsUsed: totalCost,
      rawCount: rawResults.length,
    });
  } catch (e: any) {
    console.error("[recon] POST failed", e);
    return new NextResponse(`Recon search failed: ${e.message}`, { status: 500 });
  }
}

/**
 * GET /api/recon
 * Returns the user's 10 most recent recon searches.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const searches = await db.reconSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ searches });
}
