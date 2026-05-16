"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, DollarSign, ExternalLink } from "lucide-react";
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

type PayPalTransaction = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  date: string;
  email?: string;
  note?: string;
};

type PayPalSummary = {
  totalIn: number;
  totalOut: number;
  net: number;
  currency: string;
  transactions: PayPalTransaction[];
  period: { from: string; to: string };
};

export function RevenueDashboard({
  connected,
  paypalConnected,
}: {
  connected: boolean;
  paypalConnected: boolean;
}) {
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

  return (
    <div className="space-y-10">
      {/* Stripe section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Stripe</h2>
        </div>

        {!connected ? (
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
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* PayPal section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">PayPal</h2>
        </div>
        <PaypalSection initialConnected={paypalConnected} />
      </div>
    </div>
  );
}

function PaypalSection({ initialConnected }: { initialConnected: boolean }) {
  const [connected, setConnected] = useState(initialConnected);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [summary, setSummary] = useState<PayPalSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    if (!clientId.trim() || !clientSecret.trim()) {
      setConnectError("Both Client ID and Client Secret are required.");
      return;
    }
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/paypal/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      const json = await res.json();
      if (!res.ok) { setConnectError(json.error ?? "Connection failed."); return; }
      setConnected(true);
      setClientId("");
      setClientSecret("");
    } catch {
      setConnectError("Request failed.");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect PayPal?")) return;
    await fetch("/api/paypal/connect", { method: "DELETE" });
    setConnected(false);
    setSummary(null);
    setError(null);
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/paypal/transactions");
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to load."); return; }
      setSummary(json);
    } catch { setError("Request failed."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (connected) loadData(); }, [connected]); // eslint-disable-line

  function fmtCurrency(n: number, cur?: string) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (cur ?? summary?.currency ?? "GBP").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(n);
  }

  if (!connected) {
    return (
      <div className="card p-6 space-y-4">
        <div>
          <p className="font-semibold">Connect your PayPal account</p>
          <p className="mt-1 text-sm text-text-muted">
            View your last 30 days of PayPal income, expenses, and transactions.{" "}
            <a
              href="https://developer.paypal.com/dashboard/applications"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-text-muted underline underline-offset-4 hover:text-text"
            >
              Get credentials from PayPal Developer Portal
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        <div className="space-y-2">
          <input
            className="input w-full"
            placeholder="Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={connecting}
          />
          <input
            className="input w-full"
            type="password"
            placeholder="Client Secret"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            disabled={connecting}
            onKeyDown={(e) => e.key === "Enter" && connect()}
          />
        </div>
        {connectError && (
          <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {connectError}
          </div>
        )}
        <button onClick={connect} disabled={connecting} className="btn-primary">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {connecting ? "Connecting..." : "Connect PayPal"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm text-text-muted">Connected</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading} className="btn-secondary text-xs">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
          <button onClick={disconnect} className="btn-ghost text-xs text-red-400 hover:text-red-300">
            Disconnect
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {loading && !summary && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      )}

      {summary && (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Total in (30d)" value={fmtCurrency(summary.totalIn)} highlight />
            <Metric label="Total out (30d)" value={fmtCurrency(summary.totalOut)} />
            <Metric label="Net (30d)" value={fmtCurrency(summary.net)} />
          </div>

          {/* Transaction list */}
          {summary.transactions.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-bg-border">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Recent transactions (last 30 days)
                </p>
              </div>
              <div className="divide-y divide-bg-border">
                {summary.transactions.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-text-muted">
                        {t.note ?? t.email ?? t.type}
                      </p>
                      <p className="text-[11px] text-text-dim">
                        {t.status} · {new Date(t.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p
                      className={`tabular-nums text-sm font-medium shrink-0 ${
                        t.amount >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {fmtCurrency(t.amount, t.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.transactions.length === 0 && (
            <p className="text-center text-sm text-text-muted py-6">No transactions in the last 30 days.</p>
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
