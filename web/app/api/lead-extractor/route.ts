import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { braveSearch } from "@/lib/brave";
import { startRunAndWait, getDatasetItems } from "@/lib/apify";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:(?:\+44|0044|0)[\s\-.]?(?:\d[\s\-.]?){9,10}|\+\d{1,3}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d[\s\-.\d]{6,})/g;

const CREDITS_PER_ACCOUNT = 20;

// Batch limits and research depth by tier
const TIER_LIMITS: Record<string, { maxAccounts: number; braveSearch: boolean; deepSearch: boolean }> = {
  PRO:   { maxAccounts: 10, braveSearch: false, deepSearch: false },
  ELITE: { maxAccounts: 25, braveSearch: true,  deepSearch: false },
  APEX:  { maxAccounts: 50, braveSearch: true,  deepSearch: true  },
};

// ── Parsers ────────────────────────────────────────────────────────────────

type ParsedAccount = {
  platform: "instagram" | "tiktok";
  handle: string;
  profileUrl: string;
};

function parseAccount(raw: string): ParsedAccount | null {
  const s = raw.trim();

  if (/instagram\.com/i.test(s)) {
    const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    if (!m) return null;
    const handle = m[1].replace(/\/$/, "").toLowerCase();
    return { platform: "instagram", handle, profileUrl: `https://www.instagram.com/${handle}/` };
  }

  if (/tiktok\.com/i.test(s)) {
    const m = s.match(/tiktok\.com\/@?([A-Za-z0-9._]+)/i);
    if (!m) return null;
    const handle = m[1].replace(/\/$/, "").toLowerCase();
    return { platform: "tiktok", handle, profileUrl: `https://www.tiktok.com/@${handle}` };
  }

  // Bare @handle — can't determine platform
  return null;
}

// ── Contact helpers ────────────────────────────────────────────────────────

function cleanEmails(raw: string[]): string[] {
  const BAD = ["noreply", "no-reply", "example", "sentry", "@schema", "@context", "@2x", ".png", ".jpg", ".gif", ".svg"];
  return [...new Set(raw.filter((e) => !BAD.some((b) => e.includes(b))))].slice(0, 5);
}

function cleanPhones(raw: string[]): string[] {
  return [...new Set(raw.filter((p) => {
    const d = p.replace(/\D/g, "");
    return d.length >= 10 && d.length <= 15;
  }))].slice(0, 5);
}

function extractFromText(text: string): { emails: string[]; phones: string[] } {
  return {
    emails: cleanEmails(text.match(EMAIL_RE) ?? []),
    phones: cleanPhones(text.match(PHONE_RE) ?? []),
  };
}

async function scrapeWebsite(url: string): Promise<{ emails: string[]; phones: string[] }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { emails: [], phones: [] };
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    return extractFromText(text);
  } catch {
    return { emails: [], phones: [] };
  }
}

// ── TikTok profile scrape ──────────────────────────────────────────────────

type TikTokProfile = {
  name?: string;
  bio?: string;
  website?: string;
  followers?: number;
};

async function scrapeTikTokProfile(handle: string): Promise<TikTokProfile | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/@${handle}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // TikTok embeds profile JSON in a script tag
    const scriptMatch = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!scriptMatch) return null;

    const json = JSON.parse(scriptMatch[1]);
    const userInfo =
      json?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"]?.userInfo;
    if (!userInfo) return null;

    const user = userInfo.user ?? {};
    const stats = userInfo.stats ?? {};

    return {
      name: user.nickname ?? undefined,
      bio: user.signature ?? undefined,
      website: user.bioLink?.link ?? undefined,
      followers: stats.followerCount ?? undefined,
    };
  } catch {
    return null;
  }
}

// ── Brave fallback search ──────────────────────────────────────────────────

async function searchForContact(
  name: string,
  handle: string,
  platform: string
): Promise<{ website?: string; emails: string[]; phones: string[] }> {
  try {
    // First search: find their website / contact page
    const results = await braveSearch({
      query: `"${name || handle}" ${platform} business contact email`,
      count: 5,
    });

    let website: string | undefined;
    const allText = results.map((r) => `${r.title} ${r.description}`).join(" ");
    const { emails, phones } = extractFromText(allText);

    // Try to find a non-social website in results
    const socials = ["facebook", "instagram", "tiktok", "twitter", "linkedin", "youtube"];
    for (const r of results) {
      try {
        const host = new URL(r.url).hostname;
        if (!socials.some((s) => host.includes(s))) {
          website = r.url;
          break;
        }
      } catch { /* ignore */ }
    }

    return { website, emails, phones };
  } catch {
    return { emails: [], phones: [] };
  }
}

// ── Result type ────────────────────────────────────────────────────────────

export type ExtractedLead = {
  handle: string;
  platform: "instagram" | "tiktok";
  profileUrl: string;
  name?: string;
  bio?: string;
  website?: string;
  followers?: number;
  emails: string[];
  phones: string[];
  sources: string[]; // where we found data: "bio" | "website" | "search"
};

// ── POST /api/lead-extractor ───────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const rl = rateLimit(`lead-extractor:${userId}`, 3, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (user.tier === "FREE") {
    return NextResponse.json(
      { error: "Lead Extractor is a Pro+ feature.", upgrade: true },
      { status: 403 }
    );
  }

  const tierConfig = TIER_LIMITS[user.tier] ?? TIER_LIMITS.PRO;

  const body = await req.json().catch(() => ({}));
  const rawLines: string[] = (body.accounts ?? [])
    .map((a: string) => a.trim())
    .filter(Boolean);

  if (rawLines.length === 0)
    return NextResponse.json({ error: "No accounts provided." }, { status: 400 });
  if (rawLines.length > tierConfig.maxAccounts)
    return NextResponse.json(
      { error: `Your plan allows up to ${tierConfig.maxAccounts} accounts per batch. Upgrade to process more.`, upgrade: true },
      { status: 400 }
    );

  const parsed: ParsedAccount[] = [];
  const invalid: string[] = [];
  for (const line of rawLines) {
    const p = parseAccount(line);
    if (p) parsed.push(p);
    else invalid.push(line);
  }

  if (parsed.length === 0)
    return NextResponse.json(
      { error: "No valid Instagram or TikTok URLs found. Paste full profile URLs (e.g. https://www.instagram.com/handle)." },
      { status: 400 }
    );

  const totalCost = parsed.length * CREDITS_PER_ACCOUNT;
  if (user.credits < totalCost) {
    return NextResponse.json(
      { error: `This batch costs ${totalCost} credits. You have ${user.credits}.`, upgrade: true },
      { status: 402 }
    );
  }

  // Build a mutable map keyed by handle
  const leads = new Map<string, ExtractedLead>();
  for (const acc of parsed) {
    leads.set(acc.handle, {
      handle: acc.handle,
      platform: acc.platform,
      profileUrl: acc.profileUrl,
      emails: [],
      phones: [],
      sources: [],
    });
  }

  const igAccounts = parsed.filter((a) => a.platform === "instagram");
  const ttAccounts = parsed.filter((a) => a.platform === "tiktok");

  // ── 1. Instagram: batch Apify run ─────────────────────────────────────
  if (igAccounts.length > 0) {
    try {
      const runId = await startRunAndWait(
        "instagram",
        {
          directUrls: igAccounts.map((a) => a.profileUrl),
          resultsType: "details",
          resultsLimit: 1,
          maxRequestRetries: 2,
        },
        90
      );
      const items = await getDatasetItems<any>(runId);
      for (const item of items) {
        const handle = (item.username ?? "").toLowerCase();
        const lead = leads.get(handle);
        if (!lead) continue;

        const bio = item.biography ?? "";
        const { emails: bioEmails, phones: bioPhones } = extractFromText(bio);

        lead.name = item.fullName || undefined;
        lead.bio = bio || undefined;
        lead.website = item.externalUrl || undefined;
        lead.followers = item.followersCount || undefined;

        if (bioEmails.length || bioPhones.length) {
          lead.emails.push(...bioEmails);
          lead.phones.push(...bioPhones);
          lead.sources.push("bio");
        }
      }
    } catch (e) {
      console.error("[lead-extractor] Instagram Apify run failed", e);
    }
  }

  // ── 2. TikTok: direct page scrape ─────────────────────────────────────
  if (ttAccounts.length > 0) {
    await Promise.all(
      ttAccounts.map(async (acc) => {
        const profile = await scrapeTikTokProfile(acc.handle);
        const lead = leads.get(acc.handle);
        if (!lead) return;

        if (profile) {
          lead.name = profile.name;
          lead.bio = profile.bio;
          lead.website = profile.website;
          lead.followers = profile.followers;

          if (profile.bio) {
            const { emails, phones } = extractFromText(profile.bio);
            if (emails.length || phones.length) {
              lead.emails.push(...emails);
              lead.phones.push(...phones);
              lead.sources.push("bio");
            }
          }
        }
      })
    );
  }

  // ── 3. Website scraping for all accounts ──────────────────────────────
  // Process in batches of 8 to avoid overwhelming targets
  const allLeads = Array.from(leads.values());
  const BATCH = 8;
  for (let i = 0; i < allLeads.length; i += BATCH) {
    await Promise.all(
      allLeads.slice(i, i + BATCH).map(async (lead) => {
        if (!lead.website) return;
        const { emails, phones } = await scrapeWebsite(lead.website);
        const addedEmails = emails.filter((e) => !lead.emails.includes(e));
        const addedPhones = phones.filter((p) => !lead.phones.includes(p));
        if (addedEmails.length || addedPhones.length) {
          lead.emails.push(...addedEmails);
          lead.phones.push(...addedPhones);
          if (!lead.sources.includes("website")) lead.sources.push("website");
        }
      })
    );
  }

  // ── 4. Brave search fallback (ELITE+ only) ────────────────────────────
  if (tierConfig.braveSearch) {
    // Standard: only search accounts with no contact info yet
    // Deep (APEX): also search accounts that have some info, to surface more
    const needsSearch = tierConfig.deepSearch
      ? allLeads
      : allLeads.filter((l) => l.emails.length === 0 && l.phones.length === 0);

    // Rate-limit: max 3 Brave calls at once
    for (let i = 0; i < needsSearch.length; i += 3) {
      await Promise.all(
        needsSearch.slice(i, i + 3).map(async (lead) => {
          const { website, emails, phones } = await searchForContact(
            lead.name ?? "",
            lead.handle,
            lead.platform
          );
          if (website && !lead.website) {
            lead.website = website;
            const scraped = await scrapeWebsite(website);
            emails.push(...scraped.emails);
            phones.push(...scraped.phones);
          }
          const newEmails = emails.filter((e) => !lead.emails.includes(e));
          const newPhones = phones.filter((p) => !lead.phones.includes(p));
          if (newEmails.length || newPhones.length) {
            lead.emails.push(...newEmails);
            lead.phones.push(...newPhones);
            if (!lead.sources.includes("search")) lead.sources.push("search");
          }
        })
      );
    }
  }

  // ── 5. Finalise & dedupe ───────────────────────────────────────────────
  for (const lead of allLeads) {
    lead.emails = cleanEmails(lead.emails);
    lead.phones = cleanPhones(lead.phones);
    lead.sources = [...new Set(lead.sources)];
  }

  // ── 6. Deduct credits ─────────────────────────────────────────────────
  await db.user.update({
    where: { id: userId },
    data: { credits: { decrement: totalCost } },
  });
  await db.creditTransaction.create({
    data: { userId, amount: -totalCost, source: "spend_lead_extractor" },
  });

  return NextResponse.json({
    results: allLeads,
    creditsUsed: totalCost,
    invalid: invalid.length > 0 ? invalid : undefined,
  });
}
