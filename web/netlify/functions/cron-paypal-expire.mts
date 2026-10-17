import type { Config } from "@netlify/functions";

/**
 * Fires every hour at :50.
 * Moves cancelled PayPal subscriptions to Free once their paid month ends.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/paypal-expire`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] paypal-expire → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "50 * * * *",
};
