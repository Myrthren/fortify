import type { Config } from "@netlify/functions";

/**
 * Checks for due watches every five minutes. Each watch is due once per day;
 * failed scans have a bounded retry delay and concurrent scans use a lease.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/competitor-watch-scan`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] competitor-scan → ${res.status} ${res.statusText}`);
  if (!res.ok) throw new Error(`Watch scheduler returned HTTP ${res.status}`);
  const result = await res.json();
  console.log(`[cron] watches: checked=${result.checked}, changed=${result.changed}, errors=${result.errors}`);
  if (result.ok === false) throw new Error("Watch scheduler reported failures; inspect scan history");
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
