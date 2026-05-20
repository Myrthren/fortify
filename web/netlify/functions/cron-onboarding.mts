import type { Config } from "@netlify/functions";

/**
 * Fires every day at 08:30 UTC.
 * Calls the onboarding drip cron endpoint — sends Day 1/3/7 Discord DMs.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/onboarding`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] onboarding → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "30 8 * * *",
};
