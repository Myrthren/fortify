import type { Config } from "@netlify/functions";

/** Refreshes one due Website Pulse each hour, keeping the scheduled job bounded. */
export default async function handler() {
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";
  try {
    const response = await fetch(`${baseUrl}/api/cron/site-pulse`, {
      method: "POST", headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" }, signal: AbortSignal.timeout(25_000),
    });
    console.log(`[cron] site-pulse → ${response.status} ${await response.text()}`);
  } catch (error) {
    console.log(`[cron] site-pulse timed out or failed (${(error as Error).name})`);
  }
}

export const config: Config = { schedule: "15 * * * *" };
