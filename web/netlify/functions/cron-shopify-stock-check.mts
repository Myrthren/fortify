import type { Config } from "@netlify/functions";

/**
 * Fires daily at 06:00 UTC.
 * Calls the shopify-stock-check cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/shopify-stock-check`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] shopify-stock-check → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "0 6 * * *",
};
