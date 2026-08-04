import type { Config } from "@netlify/functions";

/**
 * Fires daily at 07:30 UTC.
 * Calls the trend-alert cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/trend-alert`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] trend-alert → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "30 7 * * *",
};
