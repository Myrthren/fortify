"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2, RefreshCw, BarChart2, Search, Youtube, AlertCircle, CheckCircle,
} from "lucide-react";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────────────

type GAProperty = { name: string; displayName: string };

type GoogleConn = {
  connected: boolean;
  gaPropertyId: string | null;
  gaPropertyName: string | null;
  scSiteUrl: string | null;
};

type GA4Data = {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
  topPages: { page: string; sessions: number }[];
  topCountries: { country: string; users: number }[];
  propertyName?: string;
};

type SCData = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages: { page: string; clicks: number; impressions: number }[];
  siteUrl?: string;
};

type YTData = {
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  subscribersGained: number;
  subscribersLost: number;
};

type Tab = "ga4" | "search" | "youtube";

const PRESETS = [
  { value: 7,  label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

// ─── Main component ────────────────────────────────────────────────────────────

export function AnalyticsDashboard({ conn }: { conn: GoogleConn }) {
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("google") === "connected";
  const oauthError = searchParams.get("error");

  const [tab, setTab] = useState<Tab>("ga4");
  const [days, setDays] = useState(30);

  // Setup state
  const [showSetup, setShowSetup] = useState(
    conn.connected && !conn.gaPropertyId && !conn.scSiteUrl
  );
  const [gaProperties, setGaProperties] = useState<GAProperty[]>([]);
  const [scSites, setScSites] = useState<string[]>([]);
  const [setupLoading, setSetupLoading] = useState(false);
  const [selectedProp, setSelectedProp] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);
  const [localConn, setLocalConn] = useState(conn);

  // Data state per tab
  const [ga4Data, setGa4Data] = useState<GA4Data | null>(null);
  const [scData, setScData] = useState<SCData | null>(null);
  const [ytData, setYtData] = useState<YTData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load properties for setup
  useEffect(() => {
    if (!showSetup) return;
    setSetupLoading(true);
    fetch("/api/google/properties")
      .then((r) => r.json())
      .then((d) => {
        setGaProperties(d.gaProperties ?? []);
        setScSites(d.scSites ?? []);
        if (d.gaProperties?.length === 1) setSelectedProp(d.gaProperties[0].name);
        if (d.scSites?.length === 1) setSelectedSite(d.scSites[0]);
      })
      .finally(() => setSetupLoading(false));
  }, [showSetup]);

  async function saveSetup() {
    setSetupSaving(true);
    const prop = gaProperties.find((p) => p.name === selectedProp);
    await fetch("/api/google/setup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gaPropertyId: selectedProp || null,
        gaPropertyName: prop?.displayName ?? null,
        scSiteUrl: selectedSite || null,
      }),
    });
    setLocalConn((c) => ({
      ...c,
      gaPropertyId: selectedProp || null,
      gaPropertyName: prop?.displayName ?? null,
      scSiteUrl: selectedSite || null,
    }));
    setSetupSaving(false);
    setShowSetup(false);
  }

  const loadData = useCallback(
    async (t: Tab = tab, d: number = days) => {
      if (!localConn.connected) return;
      setLoading(true);
      setError(null);
      try {
        if (t === "ga4") {
          const res = await fetch(`/api/google/analytics?days=${d}`);
          const json = await res.json();
          if (!res.ok) { setError(json.error ?? "Failed"); return; }
          setGa4Data(json);
        } else if (t === "search") {
          const res = await fetch(`/api/google/search-console?days=${d}`);
          const json = await res.json();
          if (!res.ok) { setError(json.error ?? "Failed"); return; }
          setScData(json);
        } else {
          const res = await fetch(`/api/google/youtube?days=${d}`);
          const json = await res.json();
          if (!res.ok) { setError(json.error ?? "Failed"); return; }
          setYtData(json);
        }
      } catch {
        setError("Request failed.");
      } finally {
        setLoading(false);
      }
    },
    [tab, days, localConn.connected]
  );

  // Load data when tab/days change (if set up)
  useEffect(() => {
    if (localConn.connected && !showSetup) loadData(tab, days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, days, showSetup, localConn.connected]);

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!localConn.connected) {
    return (
      <div className="card p-8 text-center space-y-4">
        <BarChart2 className="mx-auto h-8 w-8 text-text-muted" />
        <div>
          <p className="font-semibold">Connect Google Analytics</p>
          <p className="mt-1 text-sm text-text-muted">
            Link your Google account to pull GA4, Search Console, and YouTube Analytics into one dashboard.
          </p>
        </div>
        {oauthError && (
          <p className="text-xs text-red-300">Google returned an error: {oauthError}. Try again.</p>
        )}
        <a
          href="/api/google/connect"
          className="btn-primary inline-flex items-center gap-2"
        >
          Connect Google
        </a>
      </div>
    );
  }

  // ── Setup wizard ───────────────────────────────────────────────────────────
  if (showSetup) {
    return (
      <div className="space-y-4">
        {justConnected && (
          <div className="flex items-center gap-2 rounded-md border border-green-900/40 bg-green-950/30 px-3 py-2 text-sm text-green-300">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Google connected — select your properties below to start seeing data.
          </div>
        )}
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="font-semibold">Set up your Google properties</h2>
            <p className="mt-1 text-sm text-text-muted">
              Choose which GA4 property and Search Console site to pull data from. You can change these in Settings later.
            </p>
          </div>

          {setupLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your properties…
            </div>
          ) : (
            <div className="space-y-4">
              {/* GA4 */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-2">
                  Google Analytics 4 property
                </label>
                {gaProperties.length === 0 ? (
                  <p className="text-xs text-text-muted">No GA4 properties found on this account.</p>
                ) : (
                  <select
                    className="input w-full"
                    value={selectedProp}
                    onChange={(e) => setSelectedProp(e.target.value)}
                  >
                    <option value="">Skip (no GA4)</option>
                    {gaProperties.map((p) => (
                      <option key={p.name} value={p.name}>{p.displayName}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Search Console */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-2">
                  Search Console site
                </label>
                {scSites.length === 0 ? (
                  <p className="text-xs text-text-muted">No Search Console sites found on this account.</p>
                ) : (
                  <select
                    className="input w-full"
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                  >
                    <option value="">Skip (no Search Console)</option>
                    {scSites.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={saveSetup} disabled={setupSaving} className="btn-primary text-sm">
                  {setupSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save and continue
                </button>
                <button
                  onClick={() => setShowSetup(false)}
                  className="btn-ghost text-sm"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {justConnected && (
        <div className="flex items-center gap-2 rounded-md border border-green-900/40 bg-green-950/30 px-3 py-2 text-sm text-green-300">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Google connected successfully.
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => { setDays(p.value); setGa4Data(null); setScData(null); setYtData(null); }}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                days === p.value ? "bg-white/10 font-medium text-text" : "text-text-muted hover:text-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="btn-secondary text-xs"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
          <button onClick={() => setShowSetup(true)} className="text-xs text-text-muted hover:text-text transition underline-offset-2 hover:underline">
            Change properties
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-bg-border bg-bg-panel p-1">
        <TabBtn active={tab === "ga4"} onClick={() => setTab("ga4")} icon={<BarChart2 className="h-3.5 w-3.5" />} label="Analytics" sub={localConn.gaPropertyName ?? "GA4"} />
        <TabBtn active={tab === "search"} onClick={() => setTab("search")} icon={<Search className="h-3.5 w-3.5" />} label="Search Console" sub={localConn.scSiteUrl ? new URL(localConn.scSiteUrl).hostname : "GSC"} />
        <TabBtn active={tab === "youtube"} onClick={() => setTab("youtube")} icon={<Youtube className="h-3.5 w-3.5" />} label="YouTube" sub="Analytics" />
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}{" "}
          {(error.includes("property") || error.includes("site")) && (
            <button onClick={() => setShowSetup(true)} className="underline ml-1">Set up</button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      )}

      {/* GA4 */}
      {tab === "ga4" && ga4Data && !loading && <GA4View data={ga4Data} />}
      {tab === "ga4" && !ga4Data && !loading && !error && (
        <EmptyState icon={<BarChart2 className="h-5 w-5" />} text={localConn.gaPropertyId ? "Loading Analytics data…" : "No GA4 property selected."} cta={!localConn.gaPropertyId ? <button onClick={() => setShowSetup(true)} className="btn-primary text-sm mt-3">Set up GA4</button> : null} />
      )}

      {/* Search Console */}
      {tab === "search" && scData && !loading && <SCView data={scData} />}
      {tab === "search" && !scData && !loading && !error && (
        <EmptyState icon={<Search className="h-5 w-5" />} text={localConn.scSiteUrl ? "Loading Search Console data…" : "No Search Console site selected."} cta={!localConn.scSiteUrl ? <button onClick={() => setShowSetup(true)} className="btn-primary text-sm mt-3">Set up Search Console</button> : null} />
      )}

      {/* YouTube */}
      {tab === "youtube" && ytData && !loading && <YouTubeView data={ytData} days={days} />}
      {tab === "youtube" && !ytData && !loading && !error && (
        <EmptyState icon={<Youtube className="h-5 w-5" />} text="Loading YouTube Analytics…" />
      )}
    </div>
  );
}

// ─── Tab button ────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label, sub }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-3 py-2 transition ${
        active ? "bg-white/10 text-text" : "text-text-muted hover:text-text"
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </div>
      <p className="text-[10px] text-text-dim truncate max-w-[120px]">{sub}</p>
    </button>
  );
}

// ─── GA4 view ──────────────────────────────────────────────────────────────────

function GA4View({ data }: { data: GA4Data }) {
  function fmtDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Sessions"      value={data.sessions.toLocaleString()} />
        <Metric label="Users"         value={data.users.toLocaleString()} />
        <Metric label="Pageviews"     value={data.pageviews.toLocaleString()} />
        <Metric label="Bounce rate"   value={`${data.bounceRate}%`} />
        <Metric label="Avg. duration" value={fmtDuration(data.avgSessionDuration)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {data.topPages.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-bg-border">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Top Pages</p>
            </div>
            <div className="divide-y divide-bg-border">
              {data.topPages.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5">
                  <p className="text-sm truncate flex-1 text-text-muted" title={p.page}>{p.page}</p>
                  <span className="ml-4 shrink-0 tabular-nums text-sm font-medium">{p.sessions.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.topCountries.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-bg-border">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Top Countries</p>
            </div>
            <div className="divide-y divide-bg-border">
              {data.topCountries.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5">
                  <p className="text-sm">{c.country}</p>
                  <span className="tabular-nums text-sm font-medium">{c.users.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Search Console view ───────────────────────────────────────────────────────

function SCView({ data }: { data: SCData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Clicks"      value={data.clicks.toLocaleString()} />
        <Metric label="Impressions" value={data.impressions.toLocaleString()} />
        <Metric label="Avg. CTR"    value={`${data.ctr}%`} />
        <Metric label="Avg. Position" value={data.position.toString()} />
      </div>

      {data.topQueries.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-bg-border">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Top Queries</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border">
                  <th className="px-5 py-2 text-left text-xs text-text-muted font-medium">Query</th>
                  <th className="px-4 py-2 text-right text-xs text-text-muted font-medium">Clicks</th>
                  <th className="px-4 py-2 text-right text-xs text-text-muted font-medium">Impressions</th>
                  <th className="px-4 py-2 text-right text-xs text-text-muted font-medium">CTR</th>
                  <th className="px-4 py-2 text-right text-xs text-text-muted font-medium">Pos.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-border">
                {data.topQueries.map((q, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2.5 truncate max-w-[200px]" title={q.query}>{q.query}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{q.clicks}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{q.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{q.ctr}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{q.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.topPages.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-bg-border">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Top Pages</p>
          </div>
          <div className="divide-y divide-bg-border">
            {data.topPages.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5 gap-3">
                <p className="text-sm truncate flex-1 text-text-muted" title={p.page}>{p.page}</p>
                <span className="shrink-0 text-xs text-text-muted">{p.impressions.toLocaleString()} impressions</span>
                <span className="shrink-0 tabular-nums text-sm font-medium">{p.clicks} clicks</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── YouTube Analytics view ────────────────────────────────────────────────────

function YouTubeView({ data, days }: { data: YTData; days: number }) {
  function fmtDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Views" value={data.views.toLocaleString()} />
        <Metric label="Watch time" value={`${Math.round(data.estimatedMinutesWatched / 60).toLocaleString()}h`} />
        <Metric label="Avg. view duration" value={fmtDuration(data.averageViewDuration)} />
        <Metric label="Subs gained" value={`+${data.subscribersGained.toLocaleString()}`} />
        <Metric label="Subs lost" value={`-${data.subscribersLost.toLocaleString()}`} />
      </div>
      <div className="card p-5">
        <p className="text-xs text-text-muted">
          Data for the last {days} days from YouTube Studio Analytics.{" "}
          <a
            href="https://studio.youtube.com"
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-text transition"
          >
            Open YouTube Studio →
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Shared ────────────────────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyState({ icon, text, cta }: { icon: React.ReactNode; text: string; cta?: React.ReactNode }) {
  return (
    <div className="card p-8 text-center text-sm text-text-muted">
      <div className="mx-auto mb-3 w-fit opacity-60">{icon}</div>
      <p>{text}</p>
      {cta}
    </div>
  );
}
