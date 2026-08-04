import type { Config } from "@netlify/functions";

/**
 * Fires every 15 minutes.
 * Calls the auto-publish cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/auto-publish`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] auto-publish → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "*/15 * * * *",
};
