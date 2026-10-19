// Shared by Fortify Recon (app/api/recon) and the weekly lead pack.

// Shape returned by compass~crawler-google-places
export type GooglePlaceResult = {
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

/** Apify input for a Google Maps search, as Recon runs it. */
export function googleMapsInput(category: string, location: string, count: number) {
  return {
    searchStringsArray: [`${category} ${location}`],
    maxCrawledPlacesPerSearch: count,
    language: "en",
    maxImages: 0,
    exportPlaceUrls: false,
    additionalInfo: false,
    maxReviews: 0,
    maxQuestions: 0,
    scrapeDirectories: false,
  };
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** Emails published on a business's own website (homepage only). */
export async function scrapeEmails(url: string): Promise<string[]> {
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
