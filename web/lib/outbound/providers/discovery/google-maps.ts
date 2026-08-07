import { startRun, getRunStatus, getDatasetItems } from "@/lib/apify";
import type {
  DiscoveredBusiness,
  DiscoveryInput,
  DiscoveryPoll,
  DiscoveryProvider,
} from "@/lib/outbound/types";

type MapsItem = {
  title?: string;
  website?: string;
  phone?: string;
  categoryName?: string;
  city?: string;
  state?: string;
  address?: string;
  emails?: string[];
  totalScore?: number;
  reviewsCount?: number;
  url?: string;
};

/**
 * Local businesses via the Apify Google Places crawler — the same actor Recon
 * uses. Best source when the target is defined by trade plus geography, which
 * covers most of Fortify's ICP.
 *
 * Two-phase only: a place crawl takes minutes, so the run is started on one
 * tick and collected on a later one. The actor bills per place, so `limit` is
 * passed through as a hard cap rather than over-fetching and filtering here.
 */
export const googleMapsDiscovery: DiscoveryProvider = {
  key: "google-maps",
  label: "Google Maps (Apify)",

  isAvailable() {
    return Boolean(process.env.APIFY_API_TOKEN);
  },

  async startJob(input: DiscoveryInput): Promise<string> {
    const search = [input.industry, input.query].filter(Boolean).join(" ").trim();
    return startRun("google-maps", {
      searchStringsArray: [search || input.query],
      locationQuery: input.location ?? undefined,
      maxCrawledPlacesPerSearch: input.limit,
      language: "en",
      skipClosedPlaces: true,
      scrapeContacts: true,
    });
  },

  async pollJob(jobId: string): Promise<DiscoveryPoll> {
    const status = await getRunStatus(jobId);

    if (status === "READY" || status === "RUNNING") return { status: "running" };
    if (status !== "SUCCEEDED") {
      return { status: "failed", error: `Apify run ended as ${status}` };
    }

    const items = await getDatasetItems<MapsItem>(jobId);
    return {
      status: "done",
      results: items.filter((i) => i.title).map(toBusiness),
    };
  },
};

function toBusiness(i: MapsItem): DiscoveredBusiness {
  return {
    company: i.title!.trim(),
    website: normaliseWebsite(i.website),
    email: i.emails?.[0]?.toLowerCase() ?? null,
    phone: i.phone ?? null,
    industry: i.categoryName ?? null,
    location: [i.city, i.state].filter(Boolean).join(", ") || i.address || null,
    raw: {
      rating: i.totalScore,
      reviews: i.reviewsCount,
      mapsUrl: i.url,
      address: i.address,
    },
  };
}

function normaliseWebsite(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
