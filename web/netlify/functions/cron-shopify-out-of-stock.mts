import type { Config } from "@netlify/functions";

/**
 * Fires daily at 06:15 UTC.
 * Calls the shopify-out-of-stock cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/shopify-out-of-stock`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] shopify-out-of-stock → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "15 6 * * *",
};
