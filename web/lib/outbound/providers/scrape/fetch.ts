import type {
  ScrapeProvider,
  ScrapedPage,
  ScrapedSite,
  SiteSignals,
} from "@/lib/outbound/types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; FortifyBot/1.0; +https://fortify-io.com/bot)";
const PAGE_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 1_500_000;
/** Total text handed to the analyser. Roughly 6k tokens — enough to judge a site. */
const TEXT_BUDGET = 24_000;

/**
 * Plain-fetch scraper. No headless browser, so it misses client-rendered
 * content — which is a real limitation, not a bug we can fix here. The signal
 * detection below reads the raw HTML including inline script src attributes,
 * so third-party tools (CRM, booking, chat) are still detected on SPA sites
 * even when the visible text comes back thin.
 *
 * Swap this for a Playwright/Apify-backed provider by adding a sibling file
 * and setting OUTBOUND_SCRAPE_PROVIDER.
 */
export const fetchScraper: ScrapeProvider = {
  key: "fetch",
  label: "Direct fetch",

  isAvailable() {
    return true;
  },

  async scrape(url: string, opts?: { maxPages?: number }): Promise<ScrapedSite> {
    const started = Date.now();
    const maxPages = opts?.maxPages ?? 4;

    const home = await fetchPage(url);
    if (!home) {
      throw new Error(`Could not fetch ${url}`);
    }

    const pages: ScrapedPage[] = [
      { url: home.finalUrl, title: extractTitle(home.html), text: htmlToText(home.html) },
    ];

    // Follow the pages that actually carry buying signals. Contact and booking
    // pages are where manual processes show themselves.
    const targets = pickInternalLinks(home.html, home.finalUrl, maxPages - 1);
    let combinedHtml = home.html;

    for (const link of targets) {
      const page = await fetchPage(link);
      if (!page) continue;
      pages.push({
        url: page.finalUrl,
        title: extractTitle(page.html),
        text: htmlToText(page.html),
      });
      combinedHtml += page.html;
    }

    const text = pages
      .map((p) => `## ${p.title ?? p.url}\n${p.text}`)
      .join("\n\n")
      .slice(0, TEXT_BUDGET);

    return {
      finalUrl: home.finalUrl,
      pages,
      text,
      signals: detectSignals(combinedHtml, home.finalUrl, Date.now() - started),
    };
  },
};

async function fetchPage(
  url: string
): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    const html = (await res.text()).slice(0, MAX_HTML_BYTES);
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const LINK_PRIORITY = [
  "contact",
  "book",
  "booking",
  "appointment",
  "quote",
  "enquir",
  "inquir",
  "services",
  "about",
  "pricing",
];

function pickInternalLinks(html: string, baseUrl: string, limit: number): string[] {
  if (limit <= 0) return [];
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const found = new Map<string, number>(); // url -> priority index
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html))) {
    const href = m[1];
    const label = stripTags(m[2]).toLowerCase();
    let abs: URL;
    try {
      abs = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (abs.origin !== origin) continue;
    abs.hash = "";
    const key = abs.toString();
    if (key.replace(/\/$/, "") === baseUrl.replace(/\/$/, "")) continue;

    const haystack = `${abs.pathname} ${label}`;
    const rank = LINK_PRIORITY.findIndex((p) => haystack.includes(p));
    if (rank === -1) continue;
    if (!found.has(key) || found.get(key)! > rank) found.set(key, rank);
  }

  return [...found.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([url]) => url);
}

// ─── Signal detection ─────────────────────────────────────
// Each entry is [label, regex]. Matching against raw HTML catches script tags
// and data attributes, which is how most of these tools announce themselves.

const CRM_SIGNATURES: [string, RegExp][] = [
  ["HubSpot", /hs-scripts\.com|hubspot\.com\/|hbspt\./i],
  ["Salesforce", /salesforce\.com|pardot\.com|force\.com/i],
  ["Zoho", /zoho\.(com|eu)\/crm|zohopublic/i],
  ["Pipedrive", /pipedrive(webforms)?\.com/i],
  ["ActiveCampaign", /activehosted\.com|activecampaign\.com/i],
  ["Keap/Infusionsoft", /infusionsoft\.com|keap\.com/i],
  ["GoHighLevel", /gohighlevel\.com|msgsndr\.com|leadconnectorhq\.com/i],
];

const ANALYTICS_SIGNATURES: [string, RegExp][] = [
  ["Google Analytics", /googletagmanager\.com|google-analytics\.com|gtag\(/i],
  ["Meta Pixel", /connect\.facebook\.net|fbq\(/i],
  ["Hotjar", /hotjar\.com/i],
  ["Plausible", /plausible\.io/i],
  ["Clarity", /clarity\.ms/i],
];

const BOOKING_SIGNATURES: [string, RegExp][] = [
  ["Calendly", /calendly\.com/i],
  ["Acuity", /acuityscheduling\.com/i],
  ["Cal.com", /\bcal\.com\b/i],
  ["Square Appointments", /squareup\.com\/appointments/i],
  ["Setmore", /setmore\.com/i],
  ["Fresha", /fresha\.com/i],
  ["Treatwell", /treatwell\./i],
  ["OpenTable", /opentable\./i],
  ["ResDiary", /resdiary\.com/i],
  ["SimplyBook", /simplybook\.(me|it)/i],
  ["Bookwhen", /bookwhen\.com/i],
  ["Timely", /gettimely\.com/i],
];

const CHAT_SIGNATURES: [string, RegExp][] = [
  ["Intercom", /intercom\.(io|com)|widget\.intercom/i],
  ["Drift", /drift\.com|driftt\.com/i],
  ["Tidio", /tidio(chat)?\.(co|com)/i],
  ["Crisp", /crisp\.chat/i],
  ["Tawk.to", /tawk\.to/i],
  ["Zendesk Chat", /zopim\.com|zdassets\.com/i],
  ["LiveChat", /livechatinc\.com/i],
  ["Freshchat", /freshchat\.com|wchat\.freshchat/i],
  ["ManyChat", /manychat\.com/i],
];

const ECOM_SIGNATURES: [string, RegExp][] = [
  ["Shopify", /cdn\.shopify\.com|shopify\.com\/s\//i],
  ["WooCommerce", /woocommerce/i],
  ["Squarespace Commerce", /squarespace\.com/i],
  ["Wix Stores", /wixstatic\.com|wix\.com/i],
  ["BigCommerce", /bigcommerce\.com/i],
  ["Stripe", /js\.stripe\.com/i],
];

const EMAIL_SIGNATURES: [string, RegExp][] = [
  ["Mailchimp", /list-manage\.com|mailchimp\.com|mc\.us\d+/i],
  ["Klaviyo", /klaviyo\.com/i],
  ["ConvertKit", /convertkit\.com|ck\.page/i],
  ["Omnisend", /omnisend\.com/i],
  ["Brevo/Sendinblue", /sendinblue\.com|brevo\.com/i],
];

function detectSignals(html: string, url: string, fetchMs: number): SiteSignals {
  const lower = html.toLowerCase();
  const detect = (sigs: [string, RegExp][]) =>
    sigs.filter(([, re]) => re.test(html)).map(([name]) => name);

  const detectedChat = detect(CHAT_SIGNATURES);
  const detectedBooking = detect(BOOKING_SIGNATURES);

  return {
    hasSsl: url.startsWith("https://"),
    hasContactForm: /<form[\s\S]*?<\/form>/i.test(html) || /wpcf7|gravity_form|hs-form|typeform/i.test(lower),
    hasBookingWidget: detectedBooking.length > 0 || /\bbook (now|online|an? (appointment|table))\b/i.test(lower),
    hasLiveChat: detectedChat.length > 0,
    // A chat widget is not a chatbot. Only claim AI when the page says so.
    hasChatbot: /\b(ai (chat|assistant|bot)|chatbot|virtual assistant)\b/i.test(lower),
    hasNewsletterCapture: /newsletter|subscribe|mailing list/i.test(lower) && /<input[^>]*type=["']?email/i.test(html),
    hasPhoneNumber: /href=["']tel:/i.test(html),
    hasMobileViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasMetaDescription: /<meta[^>]+name=["']description["'][^>]*content=["'][^"']{10,}/i.test(html),
    titleLength: extractTitle(html)?.length ?? null,
    h1Count: (html.match(/<h1\b/gi) ?? []).length,
    detectedCrm: detect(CRM_SIGNATURES),
    detectedAnalytics: detect(ANALYTICS_SIGNATURES),
    detectedBooking,
    detectedChat,
    detectedEcommerce: detect(ECOM_SIGNATURES),
    detectedEmailMarketing: detect(EMAIL_SIGNATURES),
    socialLinks: extractSocials(html),
    emails: extractEmails(html),
    htmlBytes: html.length,
    fetchMs,
  };
}

const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
];

function extractSocials(html: string): string[] {
  const out = new Set<string>();
  const re = /href=["'](https?:\/\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const host = m[1].toLowerCase();
    const match = SOCIAL_HOSTS.find((h) => host.includes(h));
    if (match) out.add(match);
  }
  return [...out];
}

function extractEmails(html: string): string[] {
  const out = new Set<string>();
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const email = m[0].toLowerCase();
    // Filenames and tracking pixels match the pattern too.
    if (/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(email)) continue;
    if (/^(example|test|your|name|email|user)@/i.test(email)) continue;
    if (/sentry\.io|wixpress|godaddy|\.wpengine/i.test(email)) continue;
    out.add(email);
  }
  return [...out].slice(0, 10);
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(stripTags(m[1])).trim().slice(0, 200) : null;
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|h[1-6]|section|tr|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}
