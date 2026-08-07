import { braveSearch } from "@/lib/brave";
import type {
  DiscoveredBusiness,
  DiscoveryInput,
  DiscoveryProvider,
} from "@/lib/outbound/types";

/**
 * Web-search discovery. Weaker than Maps for local trades (no phone, no email,
 * no address) but it is the only option for targets that are not place-based —
 * "Shopify stores selling supplements", "UK B2B SaaS under 20 staff".
 *
 * Company names are inferred from the domain, then corrected later by the
 * analyser once the site has been scraped.
 */
export const braveDiscovery: DiscoveryProvider = {
  key: "brave",
  label: "Brave Search",

  isAvailable() {
    return Boolean(process.env.BRAVE_API_KEY);
  },

  async discover(input: DiscoveryInput): Promise<DiscoveredBusiness[]> {
    const query = [input.query, input.industry, input.location]
      .filter(Boolean)
      .join(" ")
      .trim();

    const results = await braveSearch({ query, count: Math.min(input.limit, 20) });

    const seen = new Set<string>();
    const out: DiscoveredBusiness[] = [];

    for (const r of results) {
      const host = hostOf(r.url);
      if (!host || seen.has(host)) continue;
      if (isAggregator(host)) continue;
      seen.add(host);

      out.push({
        company: r.source ?? prettifyHost(host),
        website: `https://${host}`,
        industry: input.industry ?? null,
        location: input.location ?? null,
        raw: { title: r.title, description: r.description },
      });

      if (out.length >= input.limit) break;
    }

    return out;
  },
};

/**
 * Directories and platforms return high in search but are not prospects — they
 * are where prospects are listed. Filtering them here keeps the scrape budget
 * for real businesses.
 */
const AGGREGATORS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "yelp.com",
  "yell.com",
  "tripadvisor.com",
  "trustpilot.com",
  "checkatrade.com",
  "thomsonlocal.com",
  "google.com",
  "bing.com",
  "wikipedia.org",
  "reddit.com",
  "amazon.com",
  "etsy.com",
  "indeed.com",
  "glassdoor.com",
  "crunchbase.com",
  "medium.com",
  "wordpress.com",
  "blogspot.com",
  "pinterest.com",
  "quora.com",
];

function isAggregator(host: string): boolean {
  return AGGREGATORS.some((a) => host === a || host.endsWith(`.${a}`));
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function prettifyHost(host: string): string {
  const base = host.split(".")[0].replace(/[-_]+/g, " ");
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}
