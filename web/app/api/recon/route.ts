import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { braveSearch } from "@/lib/brave";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
// UK & general phone patterns
const PHONE_RE = /(?:(?:\+44|0044|0)[\s\-.]?(?:\d[\s\-.]?){9,10}|\+\d{1,3}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d[\s\-.\d]{6,})/g;

async function scrapeContacts(url: string): Promise<{ emails: string[]; phones: string[] }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { emails: [], phones: [] };
    const html = await res.text();
    const emails = [...new Set((html.match(EMAIL_RE) ?? []).filter(
      (e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".gif") && !e.includes("@2x")
    ))].slice(0, 5);
    const phones = [...new Set(html.match(PHONE_RE) ?? [])].slice(0, 5);
    return { emails, phones };
  } catch {
    return { emails: [], phones: [] };
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
 * Body: { location, category, count?, filters?, extractEmails?, extractPhones?, applyContext? }
 * Requires ELITE or APEX tier. Base cost 50 credits.
 * +25 credits for extractEmails, +25 for extractPhones, +25 for applyContext.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  // 5 recon searches per minute per user
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
  const extractPhones: boolean = body.extractPhones === true;
  const applyContext: boolean = body.applyContext === true;
  // Count: clamp between 5 and 20, default 10
  const count: number = Math.min(20, Math.max(5, Math.round(Number(body.count ?? 10))));

  if (!location) return NextResponse.json({ error: "location is required." }, { status: 400 });
  if (!category) return NextResponse.json({ error: "category is required." }, { status: 400 });

  // Calculate credit cost
  const baseCost = 50;
  const emailCost = extractEmails ? 25 : 0;
  const phoneCost = extractPhones ? 25 : 0;
  const contextCost = applyContext ? 25 : 0;
  const totalCost = baseCost + emailCost + phoneCost + contextCost;

  if (user.credits < totalCost) {
    return NextResponse.json(
      { error: `This search costs ${totalCost} credits. You have ${user.credits}.`, upgrade: true },
      { status: 402 }
    );
  }

  const query = `${category} in ${location} contact`;

  try {
    const rawResults = await braveSearch({ query, count });

    // Base leads
    let leads: {
      title: string;
      url: string;
      description: string;
      source?: string;
      emails?: string[];
      phones?: string[];
      context?: string;
    }[] = rawResults.map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      source: r.source,
    }));

    // Contact extraction + AI context (run in parallel)
    const [scrapedAll, contextAll] = await Promise.all([
      (extractEmails || extractPhones)
        ? Promise.all(leads.map((lead) => scrapeContacts(lead.url)))
        : Promise.resolve(null),
      applyContext
        ? Promise.all(leads.map((lead) => generateLeadContext(lead, category, location)))
        : Promise.resolve(null),
    ]);

    leads = leads.map((lead, i) => ({
      ...lead,
      emails: extractEmails && scrapedAll ? scrapedAll[i].emails : undefined,
      phones: extractPhones && scrapedAll ? scrapedAll[i].phones : undefined,
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

    // Persist search
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
