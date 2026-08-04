import type { Config } from "@netlify/functions";

/**
 * Fires on the 1st of each month at 00:00 UTC.
 * Calls the monthly-credits cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/monthly-credits`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] monthly-credits → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "0 0 1 * *",
};
