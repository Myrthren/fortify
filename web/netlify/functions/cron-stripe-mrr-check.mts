import type { Config } from "@netlify/functions";

/**
 * Fires every Monday at 11:30 UTC.
 * Calls the stripe-mrr-check cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/stripe-mrr-check`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] stripe-mrr-check → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "30 11 * * 1",
};
