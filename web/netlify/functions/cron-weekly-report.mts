import type { Config } from "@netlify/functions";

/**
 * Fires every Monday at 09:00 UTC.
 * Calls the weekly-report cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/weekly-report`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] weekly-report → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "0 9 * * 1",
};
