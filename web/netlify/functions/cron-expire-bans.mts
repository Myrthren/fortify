import type { Config } from "@netlify/functions";

/**
 * Fires every hour at :20.
 * Calls the expire-bans cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/expire-bans`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] expire-bans → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "20 * * * *",
};
