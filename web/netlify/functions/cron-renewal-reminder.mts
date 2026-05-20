import type { Config } from "@netlify/functions";

/**
 * Fires every day at 08:00 UTC.
 * Calls the renewal-reminder cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/renewal-reminder`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] renewal-reminder → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "0 8 * * *",
};
