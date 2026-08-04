import type { Config } from "@netlify/functions";

/**
 * Fires every Monday at 09:30 UTC.
 * Calls the content-brief cron endpoint on the Fortify web app.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/content-brief`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] content-brief → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "30 9 * * 1",
};
