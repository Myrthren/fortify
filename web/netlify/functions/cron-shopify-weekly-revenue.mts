import type { Config } from "@netlify/functions";

/**
 * Fires every Monday at 10:30 UTC.
 * Calls the shopify-weekly-revenue cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/shopify-weekly-revenue`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] shopify-weekly-revenue → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "30 10 * * 1",
};
