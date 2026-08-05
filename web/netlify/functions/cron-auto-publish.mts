import type { Config } from "@netlify/functions";

/**
 * Fires every hour at :45.
 * Calls the auto-publish cron endpoint on the Fortify web app.
 *
 * Hourly rather than every 15 minutes: the Virality Engine is behind the
 * coming-soon gate, so nothing can be scheduled for publishing yet. Raise the
 * frequency when that ships and publish timing starts to matter.
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
  schedule: "45 * * * *",
};
