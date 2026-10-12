import type { Config } from "@netlify/functions";

/**
 * Fires every minute to support minute-level schedule expressions.
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
  if (!res.ok) throw new Error(`Workflow scheduler returned HTTP ${res.status}`);
  const result = await res.json();
  console.log(`[cron] workflows: fired=${result.fired}, errors=${result.errors}, deferred=${result.deferred}, interrupted=${result.interrupted}`);
  if (result.ok === false) throw new Error("Workflow scheduler reported failed runs; inspect run history");
}

export const config: Config = {
  schedule: "* * * * *",
};
