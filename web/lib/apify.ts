const APIFY_BASE = "https://api.apify.com/v2";

function getToken(): string {
  const t = process.env.APIFY_API_TOKEN;
  if (!t) throw new Error("APIFY_API_TOKEN is not set on this server.");
  return t;
}

export const ACTOR_IDS = {
  youtube:      "h7sDV53CddomktSi5",   // streamers/youtube-scraper
  tiktok:       "GdWCkxBtKWOsKjdch",   // clockworks/tiktok-scraper
  reddit:       "oAuCIx3ItNrs2okjQ",   // trudax/reddit-scraper-lite
  instagram:    "apify~instagram-scraper",
  twitter:      "apidojo~tweet-scraper",
  serp:         "apify~google-search-scraper",
  "google-maps": "compass~crawler-google-places", // local business lead finder
} as const;

export type Platform = keyof typeof ACTOR_IDS;

/** Start an Apify actor run and return the runId */
export async function startRun(platform: Platform, input: Record<string, unknown>): Promise<string> {
  const token = getToken();
  const actorId = ACTOR_IDS[platform];
  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify startRun failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.data.id as string;
}

/**
 * Start an actor run and block until it finishes (or waitSecs elapses).
 * Uses Apify's native waitForFinish query param — single HTTP call, no polling loop.
 * Returns the runId if SUCCEEDED, throws otherwise.
 */
export async function startRunAndWait(
  platform: Platform,
  input: Record<string, unknown>,
  waitSecs = 50
): Promise<string> {
  const token = getToken();
  const actorId = ACTOR_IDS[platform];
  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${token}&waitForFinish=${waitSecs}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify startRun failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const run = json.data;
  if (run.status !== "SUCCEEDED") {
    throw new Error(`Apify run ended with status: ${run.status}`);
  }
  return run.id as string;
}

/** Poll the status of a run. Returns "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "ABORTED" | "TIMED-OUT" */
export async function getRunStatus(runId: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
  if (!res.ok) throw new Error(`Apify getRunStatus failed (${res.status})`);
  const json = await res.json();
  return json.data.status as string;
}

/** Fetch all items from a run's default dataset */
export async function getDatasetItems<T = unknown>(runId: string): Promise<T[]> {
  const token = getToken();
  const res = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}&clean=true&format=json`
  );
  if (!res.ok) throw new Error(`Apify getDatasetItems failed (${res.status})`);
  return (await res.json()) as T[];
}
