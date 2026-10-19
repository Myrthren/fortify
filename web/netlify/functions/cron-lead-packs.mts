import type { Config } from "@netlify/functions";

/**
 * Fires every 15 minutes.
 * Builds weekly lead packs (start scrape on one tick, deliver on a later one).
 * Scheduled functions stop after 30s; the route keeps running up to ~45s, so
 * a timeout here only means the reply arrived late, not that the work stopped.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  try {
    const res = await fetch(`${baseUrl}/api/cron/lead-packs`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
      signal: AbortSignal.timeout(25_000),
    });
    console.log(`[cron] lead-packs → ${res.status} ${res.statusText} ${await res.text()}`);
  } catch (err) {
    console.log(`[cron] lead-packs → still running after 25s (${(err as Error).name})`);
  }
}

export const config: Config = {
  schedule: "*/15 * * * *",
};
