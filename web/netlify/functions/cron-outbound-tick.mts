import type { Config } from "@netlify/functions";

/**
 * Fires every 15 minutes.
 * Collects replies from the sending mailbox, then advances every active
 * outbound campaign by one bounded step.
 *
 * The cadence is the pacing mechanism: the engine sends at most one email per
 * campaign per tick, so four ticks an hour across a 9-hour window is a natural
 * ceiling of ~36 sends a day before the campaign's own cap even applies.
 */
export default async function handler() {
  const secret = process.env.CRON_SECRET ?? "";
  const baseUrl = process.env.NEXTJS_URL ?? "https://fortify-io.com";

  const res = await fetch(`${baseUrl}/api/cron/outbound-tick`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  console.log(`[cron] outbound-tick → ${res.status} ${res.statusText}`);
}

export const config: Config = {
  schedule: "*/15 * * * *",
};
