import type { Config } from "@netlify/functions";

/**
 * Fires every Monday at 11:00 UTC.
 * Calls the competitor-monitor cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/competitor-monitor`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] competitor-monitor → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "0 11 * * 1",
};
