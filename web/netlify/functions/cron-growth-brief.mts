import type { Config } from "@netlify/functions";

/**
 * Fires every hour at :35.
 * Writes one Apex member's monthly Growth Brief per run until all are done.
 * Scheduled functions stop after 30s; the route can take longer, so a timeout
 * here only means the reply arrived late, not that the brief was lost.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  try {
    const res = await fetch(`${baseUrl}/api/cron/growth-brief`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
      signal: AbortSignal.timeout(25_000),
    });
    console.log(`[cron] growth-brief → ${res.status} ${res.statusText} ${await res.text()}`);
  } catch (err) {
    console.log(`[cron] growth-brief → still running after 25s (${(err as Error).name})`);
  }
}

export const config: Config = {
  schedule: "35 * * * *",
};
