import type { Config } from "@netlify/functions";

export default async function handler() {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET not configured");
  const base = process.env.NEXTJS_URL ?? "https://fortify-io.com";
  const res = await fetch(`${base}/api/cron/whop-reconcile`, {
    method: "POST", headers: { "x-cron-secret": secret },
  });
  if (!res.ok) throw new Error(`Whop reconciliation failed (${res.status})`);
  console.log("[cron] whop-reconcile", await res.text());
}

export const config: Config = { schedule: "0 * * * *" };
