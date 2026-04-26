"use client";

import { useState } from "react";
import { Loader2, Search, AlertTriangle, Check, ArrowRight } from "lucide-react";

type Audit = {
  url: string;
  title: string | null;
  scores: {
    clarity: number;
    headline: number;
    valueProp: number;
    cta: number;
    socialProof: number;
    friction: number;
  };
  summary: string;
  wins: string[];
  issues: { area: string; severity: "low" | "med" | "high"; note: string }[];
  fixes: string[];
};

const SCORE_LABELS: Record<keyof Audit["scores"], string> = {
  clarity: "Clarity",
  headline: "Headline",
  valueProp: "Value prop",
  cta: "CTA",
  socialProof: "Social proof",
  friction: "Friction (higher = less)",
};

export function FunnelAuditor() {
  const [url, setUrl] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setAudit(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(async () => ({ error: await res.text() }));
        throw new Error(data.error ?? "Audit failed");
      }
      const data = await res.json();
      setAudit(data.audit);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
          Page URL
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            className="input flex-1"
            placeholder="yoursite.com/landing-page"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            disabled={loading}
          />
          <button
            onClick={run}
            disabled={loading || url.length < 5}
            className="btn-primary"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Audit
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Works best on static / SSR pages. SPAs (React/Vue/etc. with no SSR) may return limited content.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Fetching page + analysing — usually 10-20 seconds…
        </div>
      )}

      {audit && (
        <div className="space-y-6">
          {/* Header */}
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wide text-text-muted">Audited</p>
            <p className="mt-1 truncate font-medium">{audit.title ?? audit.url}</p>
            <p className="truncate text-xs text-text-muted">{audit.url}</p>
            <p className="mt-3 text-sm leading-relaxed">{audit.summary}</p>
          </div>

          {/* Scores grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(audit.scores) as (keyof Audit["scores"])[]).map((k) => {
              const v = audit.scores[k];
              return (
                <div key={k} className="card p-4">
                  <p className="text-xs text-text-muted">{SCORE_LABELS[k]}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    {v}
                    <span className="text-sm font-normal text-text-dim"> / 10</span>
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className={`h-full ${scoreColor(v)}`}
                      style={{ width: `${v * 10}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wins */}
          {audit.wins.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold">What's working</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {audit.wins.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Issues */}
          {audit.issues.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold">Issues</h3>
              <ul className="mt-3 space-y-3 text-sm">
                {audit.issues.map((iss, i) => (
                  <li key={i} className="flex gap-3">
                    <SeverityPill severity={iss.severity} />
                    <div className="flex-1">
                      <p className="font-medium">{iss.area}</p>
                      <p className="text-text-muted">{iss.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fixes */}
          {audit.fixes.length > 0 && (
            <div className="card-elevated ring-1 ring-white/10 p-5">
              <h3 className="font-semibold">Recommended fixes (in priority order)</h3>
              <ol className="mt-3 space-y-2 text-sm">
                {audit.fixes.map((f, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                      {i + 1}
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function scoreColor(v: number): string {
  if (v >= 8) return "bg-green-500";
  if (v >= 6) return "bg-yellow-500";
  if (v >= 4) return "bg-orange-500";
  return "bg-red-500";
}

function SeverityPill({ severity }: { severity: "low" | "med" | "high" }) {
  const cfg = {
    high: { label: "HIGH", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
    med: { label: "MED", cls: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200" },
    low: { label: "LOW", cls: "border-bg-border bg-bg-elevated text-text-muted" },
  }[severity];
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded border px-1.5 text-[10px] font-semibold tracking-wide ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}
