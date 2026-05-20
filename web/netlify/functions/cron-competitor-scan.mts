import type { Config } from "@netlify/functions";

/**
 * Fires every day at 07:00 UTC.
 * Calls the competitor-watch-scan cron endpoint to detect page changes.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/competitor-watch-scan`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] competitor-scan → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "0 7 * * *",
};
