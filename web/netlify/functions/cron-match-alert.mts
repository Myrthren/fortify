import type { Config } from "@netlify/functions";

/**
 * Fires every Monday at 10:00 UTC.
 * Calls the match-alert cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/match-alert`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] match-alert → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "0 10 * * 1",
};
