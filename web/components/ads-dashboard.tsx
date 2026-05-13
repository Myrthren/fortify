"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, ExternalLink, AlertCircle } from "lucide-react";
import Link from "next/link";

type CampaignInsight = {
  campaign_id: string;
  campaign_name: string;
  impressions: string;
  clicks: string;
  ctr: string;
  spend: string;
  reach: string;
  cpc: string;
  actions?: { action_type: string; value: string }[];
};

type AccountSummary = {
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  ctr: string;
  cpc: string;
};

type AdsData = {
  accountName: string;
  accountId: string;
  datePreset: string;
  summary: AccountSummary | null;
  campaigns: CampaignInsight[];
};

const PRESETS = [
  { value: "last_7d",  label: "Last 7 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
] as const;

export function AdsDashboard({ connected }: { connected: boolean }) {
  const [data, setData] = useState<AdsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [preset, setPreset] = useState<string>("last_30d");

  async function load(p = preset) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta/ads?datePreset=${p}`);
      const json = await res.json();
      if (!res.ok) {
        if (json.tokenExpired) setTokenExpired(true);
        setError(json.error ?? "Failed to load data.");
        return;
      }
      setData(json);
    } catch {
      setError("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (connected) load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!connected) {
    return (
      <div className="card p-8 text-center space-y-4">
        <TrendingUp className="mx-auto h-8 w-8 text-text-muted" />
        <div>
          <p className="font-semibold">Connect your Meta Ads account</p>
          <p className="mt-1 text-sm text-text-muted">
            See real campaign metrics — spend, CTR, ROAS, and per-campaign breakdowns.
          </p>
        </div>
        <a href="/api/meta/connect" className="btn-primary inline-flex w-fit mx-auto">
          Connect Meta Ads
        </a>
        <p className="text-xs text-text-muted">
          Requires Meta app review for non-developer accounts.{" "}
          <Link href="/dashboard/settings" className="underline">Manage in Settings</Link>
        </p>
      </div>
    );
  }

  if (tokenExpired) {
    return (
      <div className="card p-6 space-y-3">
        <div className="flex items-center gap-2 text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">Meta access token expired</p>
        </div>
        <p className="text-sm text-text-muted">Reconnect your account to resume pulling data.</p>
        <a href="/api/meta/connect" className="btn-primary inline-flex w-fit text-sm">
          Reconnect
        </a>
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
              onClick={() => { setPreset(p.value); load(p.value); }}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                preset === p.value
                  ? "bg-white/10 font-medium text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="btn-secondary text-xs"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      )}

      {data && (
        <>
          {/* Account header */}
          <div className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{data.accountName}</p>
              <p className="text-xs text-text-muted">{data.accountId}</p>
            </div>
            <span className="rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
              Connected
            </span>
          </div>

          {/* Summary metrics */}
          {data.summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Spend" value={`$${Number(data.summary.spend ?? 0).toLocaleString()}`} />
              <Metric label="Impressions" value={Number(data.summary.impressions ?? 0).toLocaleString()} />
              <Metric label="Reach" value={Number(data.summary.reach ?? 0).toLocaleString()} />
              <Metric label="Clicks" value={Number(data.summary.clicks ?? 0).toLocaleString()} />
              <Metric label="CTR" value={`${Number(data.summary.ctr ?? 0).toFixed(2)}%`} />
              <Metric label="CPC" value={`$${Number(data.summary.cpc ?? 0).toFixed(2)}`} />
            </div>
          )}

          {/* Campaign table */}
          {data.campaigns.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-bg-border">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Campaigns — {data.campaigns.length} active
                </p>
              </div>
              <div className="divide-y divide-bg-border">
                {data.campaigns.map((c) => {
                  const purchases = c.actions?.find(
                    (a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
                  );
                  const roas = purchases && Number(c.spend) > 0
                    ? ((Number(purchases.value) / Number(c.spend)) * 100).toFixed(0) + "% ROAS"
                    : null;

                  return (
                    <div key={c.campaign_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.campaign_name}</p>
                        {roas && <p className="text-xs text-green-400">{roas}</p>}
                      </div>
                      <div className="flex flex-wrap gap-4 text-right text-xs text-text-muted">
                        <div>
                          <p className="font-medium text-text">${Number(c.spend).toLocaleString()}</p>
                          <p>spend</p>
                        </div>
                        <div>
                          <p className="font-medium text-text">{Number(c.impressions).toLocaleString()}</p>
                          <p>impr.</p>
                        </div>
                        <div>
                          <p className="font-medium text-text">{Number(c.ctr).toFixed(2)}%</p>
                          <p>CTR</p>
                        </div>
                        <div>
                          <p className="font-medium text-text">${Number(c.cpc).toFixed(2)}</p>
                          <p>CPC</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-sm text-text-muted">
              No campaign data found for this period. Try a different date range.
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
