"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, ShoppingBag } from "lucide-react";
import Link from "next/link";

type ShopifyData = {
  shop: string;
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  topProducts: { title: string; revenue: number; units: number }[];
  customerCount: number;
  productCount: number;
  currency: string;
};

const PRESETS = [
  { value: 7,  label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

export function ShopifyDashboard({ connected }: { connected: boolean }) {
  const [data, setData] = useState<ShopifyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  async function load(d = days) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shopify/data?days=${d}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to load data."); return; }
      setData(json);
    } catch { setError("Request failed."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (connected) load(); }, []); // eslint-disable-line

  function fmt(n: number, currency: string) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(n);
  }

  if (!connected) {
    return (
      <div className="card p-8 text-center space-y-4">
        <ShoppingBag className="mx-auto h-8 w-8 text-text-muted" />
        <div>
          <p className="font-semibold">Connect your Shopify store</p>
          <p className="mt-1 text-sm text-text-muted">
            Revenue, orders, average order value, and top products.
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
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => { setDays(p.value); load(p.value); }}
              className={`rounded-md px-3 py-1.5 text-sm transition ${days === p.value ? "bg-white/10 font-medium text-text" : "text-text-muted hover:text-text"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={() => load()} disabled={loading} className="btn-secondary text-xs">
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
          {/* Store header */}
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{data.shop}</p>
              <p className="text-xs text-text-muted">{data.productCount.toLocaleString()} products · {data.customerCount.toLocaleString()} customers</p>
            </div>
            <span className="rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
              Connected
            </span>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Revenue" value={fmt(data.revenue, data.currency)} />
            <Metric label="Orders" value={data.orderCount.toLocaleString()} />
            <Metric label="Avg. order" value={fmt(data.avgOrderValue, data.currency)} />
          </div>

          {/* Top products */}
          {data.topProducts.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-bg-border">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Top products by revenue</p>
              </div>
              <div className="divide-y divide-bg-border">
                {data.topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 gap-3">
                    <p className="text-sm truncate flex-1">{p.title}</p>
                    <span className="text-xs text-text-muted shrink-0">{p.units} units</span>
                    <span className="tabular-nums text-sm font-medium shrink-0">{fmt(p.revenue, data.currency)}</span>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
