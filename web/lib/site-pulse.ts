import { resolveMx, resolveTxt } from "dns/promises";
import { readPublicPage, readableWatchText } from "@/lib/competitor-watch";
import { db } from "@/lib/db";

export type PulseFinding = {
  area: "website" | "search" | "domain" | "local";
  status: "ready" | "review" | "missing";
  title: string;
  detail: string;
};

export type SitePulseResult = {
  url: string;
  checkedAt: string;
  score: number;
  summary: string;
  findings: PulseFinding[];
};

function match(html: string, pattern: RegExp) { return html.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() ?? ""; }
function finding(area: PulseFinding["area"], status: PulseFinding["status"], title: string, detail: string): PulseFinding {
  return { area, status, title, detail };
}

/**
 * A bounded, public-web health check. It deliberately reports observed site and
 * DNS evidence only; it does not claim search rankings, inbox placement, or
 * local-listing ownership that cannot be verified without a connected account.
 */
export async function runSitePulse(rawUrl: string): Promise<SitePulseResult> {
  const supplied = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  const page = await readPublicPage(supplied);
  const url = new URL(page.finalUrl);
  const html = page.html;
  const text = readableWatchText(html);
  const title = match(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = match(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || match(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  const h1Count = (html.match(/<h1\b[^>]*>/gi) ?? []).length;
  const canonical = /<link[^>]+rel=["']canonical["'][^>]+>/i.test(html) || /<link[^>]+href=["'][^"']+["'][^>]+rel=["']canonical["'][^>]*>/i.test(html);
  const schema = /application\/ld\+json/i.test(html);
  const localSchema = /"@type"\s*:\s*"(?:LocalBusiness|Organization|Store|ProfessionalService)"/i.test(html);
  const phone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(text);
  const contact = /(?:contact us|book a call|schedule|enquire|enquiry|get in touch)/i.test(text);

  const [mx, txt, dmarc, robots] = await Promise.all([
    resolveMx(url.hostname).catch(() => []),
    resolveTxt(url.hostname).catch(() => []),
    resolveTxt(`_dmarc.${url.hostname}`).catch(() => []),
    readPublicPage(new URL("/robots.txt", url).href).then(page => page.html).catch(() => ""),
  ]);
  const joinedTxt = txt.flat().join(" ").toLowerCase();
  const joinedDmarc = dmarc.flat().join(" ").toLowerCase();
  const hasSitemap = /(?:^|\n)\s*sitemap\s*:/i.test(robots);
  const hasSpf = /v=spf1/.test(joinedTxt);
  const hasDmarc = /v=dmarc1/.test(joinedDmarc);
  const findings: PulseFinding[] = [
    title ? finding("website", "ready", "Page title found", `“${title.slice(0, 110)}”`) : finding("website", "missing", "Page title missing", "Add a concise, page-specific title so visitors and search engines can identify the page."),
    description ? finding("search", description.length >= 70 && description.length <= 170 ? "ready" : "review", "Meta description found", description.length >= 70 && description.length <= 170 ? "A concise search snippet is present." : "It is present but may be too short or long for a useful search snippet.") : finding("search", "missing", "Meta description missing", "Write a short description that says who the page is for and why it matters."),
    h1Count === 1 ? finding("search", "ready", "One primary page heading", "The page has one H1 heading.") : finding("search", "review", h1Count ? `${h1Count} primary headings found` : "No primary page heading found", "Aim for one H1 so the page has a clear topic."),
    canonical ? finding("search", "ready", "Canonical URL present", "The page declares its preferred URL.") : finding("search", "review", "No canonical URL found", "Add a canonical URL to reduce ambiguity when pages are reached through variants."),
    hasSitemap ? finding("search", "ready", "Sitemap declared in robots.txt", "A sitemap location is publicly declared.") : finding("search", "review", "No sitemap declared in robots.txt", "Add a Sitemap line to robots.txt once a sitemap is available."),
    schema ? finding("search", "ready", "Structured data detected", "The page includes JSON-LD structured data.") : finding("search", "review", "No structured data detected", "Add schema that matches the real business and page type; do not mark up claims that are not present."),
    mx.length ? finding("domain", "ready", "Mail server records found", `${mx.length} MX record${mx.length === 1 ? "" : "s"} detected.`) : finding("domain", "missing", "No mail server records found", "If this domain sends business email, check that its MX records are configured."),
    hasSpf ? finding("domain", "ready", "SPF policy found", "The domain publishes an SPF policy.") : finding("domain", "review", "No SPF policy found", "Set an SPF record before sending outreach from this domain."),
    hasDmarc ? finding("domain", "ready", "DMARC policy found", "The domain publishes a DMARC policy.") : finding("domain", "review", "No DMARC policy found", "Add a DMARC record after validating SPF and DKIM with the mail provider."),
    localSchema || (phone && contact) ? finding("local", "ready", "Public contact evidence found", localSchema ? "Business structured data is present." : "The page visibly offers contact details and an action.") : finding("local", "review", "Local trust signals are limited", "Add accurate business contact details, a clear contact path, and relevant local schema if this is a local business."),
  ];
  const ready = findings.filter(item => item.status === "ready").length;
  const score = Math.round((ready / findings.length) * 100);
  const gaps = findings.filter(item => item.status !== "ready").slice(0, 3).map(item => item.title.toLowerCase());
  return {
    url: page.finalUrl,
    checkedAt: new Date().toISOString(),
    score,
    summary: gaps.length ? `Public signals are partly ready. Review ${gaps.join(", ")}.` : "The public website and domain checks are in good shape.",
    findings,
  };
}

export async function saveSitePulse(userId: string, business: { id: string; website: string }) {
  const result = await runSitePulse(business.website);
  return db.sitePulse.create({ data: {
    userId, businessId: business.id, url: result.url, score: result.score,
    summary: result.summary, findings: result.findings, checkedAt: new Date(result.checkedAt),
  } });
}

/** Refresh one due paid member per hourly tick to keep scheduled work bounded. */
export async function sitePulseTick(now = new Date()) {
  const candidates = await db.businessProfile.findMany({
    where: { active: true, website: { not: null }, user: { tier: { not: "FREE" } } },
    select: { id: true, userId: true, website: true }, orderBy: { updatedAt: "asc" }, take: 40,
  });
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (const business of candidates) {
    const recent = await db.sitePulse.findFirst({ where: { businessId: business.id, checkedAt: { gte: since } }, select: { id: true } });
    if (recent || !business.website) continue;
    const pulse = await saveSitePulse(business.userId, { id: business.id, website: business.website });
    return { due: true, refreshed: pulse.id };
  }
  return { due: false, refreshed: null as string | null };
}
