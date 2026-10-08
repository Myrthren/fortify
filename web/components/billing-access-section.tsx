"use client";

import { useState } from "react";
import type { Tier } from "@prisma/client";
import { RefreshCw } from "lucide-react";
import { WhopConnectSection } from "@/components/whop-connect";

type Access = {
  tier: Tier;
  discordLinked: boolean;
  subscription: { provider: string; status: string; nextBillingAt: string | null } | null;
  whop: { connected: boolean; whopUserId: string | null };
};

export function BillingAccessSection({ access }: { access: Access }) {
  const [tier, setTier] = useState(access.tier);
  const [subscription, setSubscription] = useState(access.subscription);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const provider = subscription?.provider;

  async function refresh() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/billing/access/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Access refresh failed.");
      setTier(data.tier);
      setSubscription(data.subscription);
      const accessMessage = data.source === "whop"
        ? `Whop confirms ${data.tier} access.`
        : data.subscription?.provider === "paypal"
          ? `Fortify currently records ${data.tier} access. PayPal billing updates arrive separately.`
          : `Fortify currently records ${data.tier} access.`;
      setMessage(data.role === "verified"
        ? `${accessMessage} Your Discord role is correct.`
        : data.role === "not_linked"
          ? `${accessMessage} Connect Discord to use paid server channels.`
          : `${accessMessage} Discord role status could not be checked.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Access refresh failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8" aria-label="Billing and access">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Billing &amp; access</h2>
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">{tier.charAt(0) + tier.slice(1).toLowerCase()} access</p>
            <p className="mt-1 text-sm text-text-muted">
              {subscription
                ? `${provider === "whop" ? "Whop" : "PayPal"} · ${subscription.status.toLowerCase()}`
                : "No paid subscription is recorded on this account."}
            </p>
            {subscription?.nextBillingAt && subscription.status === "ACTIVE" && (
              <p className="mt-1 text-xs text-text-muted">Next billing date shown by Fortify: {new Date(subscription.nextBillingAt).toLocaleDateString()}</p>
            )}
            <p className="mt-2 text-xs text-text-muted">
              Discord account: {access.discordLinked ? "linked" : "not linked"}. Refresh to check your server role.
            </p>
          </div>
          <button type="button" onClick={refresh} disabled={busy} className="btn-secondary text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Refresh access
          </button>
        </div>
        {message && <p role="status" className="mt-4 text-sm text-emerald-300">{message}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
        <p className="mt-4 text-xs text-text-muted">
          {provider === "whop" ? <>Manage or cancel billing in your <a className="underline" href="https://whop.com/orders/">Whop orders</a>. Disconnecting Whop here does not cancel billing.</>
            : provider === "paypal" ? <>Manage billing in your <a className="underline" href="https://www.paypal.com/myaccount/autopay/">PayPal automatic payments</a>. PayPal payment changes can take a moment to reach Fortify.</>
              : <>Bought a plan? <a className="underline" href="/pricing">See your checkout options</a>, then link the account you paid with.</>}
        </p>
        {provider === "paypal" && access.whop.connected && (
          <p className="mt-2 text-xs text-amber-300">PayPal currently owns your Fortify access. Contact support before buying another plan on Whop.</p>
        )}
      </div>
      <div className="mt-4"><WhopConnectSection connected={access.whop.connected} whopUserId={access.whop.whopUserId} /></div>
    </section>
  );
}
