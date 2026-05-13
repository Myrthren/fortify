"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, DollarSign } from "lucide-react";
import Link from "next/link";

type StripeData = {
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  revenue30d: number;
  chargeCount30d: number;
  mrr: number;
  activeSubscriptions: number;
  recentCharges: { amount: number; currency: string; created: number; description: string | null }[];
};

export function RevenueDashboard({ connected }: { connected: boolean }) {
  const [data, setData] = useState<StripeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/data");
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to load."); return; }
      setData(json);
    } catch { setError("Request failed."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (connected) load(); }, []); // eslint-disable-line

  function fmt(n: number, cur?: string) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (cur ?? data?.currency ?? "usd").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  }

  if (!connected) {
    return (
      <div className="card p-8 text-center space-y-4">
        <DollarSign className="mx-auto h-8 w-8 text-text-muted" />
        <div>
          <p className="font-semibold">Connect your Stripe account</p>
          <p className="mt-1 text-sm text-text-muted">
            MRR, revenue, active subscriptions, and recent charges.
          </p>
        </div>
        <Link href="/dashboard/settings" className="btn-primary inline-flex w-fit mx-auto">
          Connect in Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={load} disabled={loading} className="btn-secondary text-xs">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      )}

      {data && (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="MRR" value={fmt(data.mrr)} highlight />
            <Metric label="Revenue (30d)" value={fmt(data.revenue30d)} />
            <Metric label="Active subs" value={data.activeSubscriptions.toLocaleString()} />
            <Metric label="Charges (30d)" value={data.chargeCount30d.toLocaleString()} />
          </div>

          {/* Balance */}
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wide text-text-muted mb-3">Stripe balance</p>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-xs text-text-muted">Available</p>
                <p className="text-xl font-semibold tabular-nums">{fmt(data.availableBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Pending</p>
                <p className="text-xl font-semibold tabular-nums text-text-muted">{fmt(data.pendingBalance)}</p>
              </div>
            </div>
          </div>

          {/* Recent charges */}
          {data.recentCharges.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-bg-border">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Recent charges (last 30 days)</p>
              </div>
              <div className="divide-y divide-bg-border">
                {data.recentCharges.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 gap-3">
                    <p className="text-sm truncate flex-1 text-text-muted">
                      {c.description ?? "Payment"}
                    </p>
                    <p className="text-xs text-text-muted shrink-0">
                      {new Date(c.created * 1000).toLocaleDateString()}
                    </p>
                    <p className="tabular-nums text-sm font-medium shrink-0">
                      {fmt(c.amount, c.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card p-4 ${highlight ? "ring-1 ring-white/10" : ""}`}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${highlight ? "text-white" : ""}`}>{value}</p>
    </div>
  );
}
