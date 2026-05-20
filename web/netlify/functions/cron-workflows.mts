import type { Config } from "@netlify/functions";

/**
 * Fires every hour at :00.
 * Calls the run-scheduled-workflows cron endpoint to trigger any
 * user workflows with matching schedule expressions.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/run-scheduled-workflows`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] run-scheduled-workflows → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "0 * * * *",
};
