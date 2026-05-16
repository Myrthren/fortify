"use client";

import { useState } from "react";
import { Loader2, Search, ExternalLink, Copy, Check, ArrowRight } from "lucide-react";
import type { ScoredLead } from "@/app/api/leads/source/route";

export function LeadSourcer() {
  const [icp, setIcp] = useState("");
  const [location, setLocation] = useState("");
  const [signal, setSignal] = useState("");
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<ScoredLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function search() {
    if (!icp.trim() || icp.trim().length < 5) {
      setError("Describe your ideal prospect (min 5 chars).");
      return;
    }
    setError(null);
    setLoading(true);
    setLeads(null);
    try {
      const res = await fetch("/api/leads/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icp: icp.trim(), location: location.trim(), signal: signal.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setLeads(data.leads);
    } catch {
      setError("Request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyHook(id: string, hook: string) {
    navigator.clipboard.writeText(hook);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function scoreColor(n: number) {
    if (n >= 8) return "text-green-400 border-green-500/30 bg-green-500/10";
    if (n >= 5) return "text-amber-300 border-amber-500/30 bg-amber-500/10";
    return "text-text-muted border-bg-border bg-bg-elevated";
  }

  return (
    <div className="space-y-6">
      {/* Search form */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
            Ideal customer profile
          </label>
          <textarea
            className="input w-full resize-none"
            rows={2}
            placeholder='E.g. "SaaS founders with 5-50 employees in fintech who are scaling their content marketing"'
            value={icp}
            maxLength={200}
            onChange={(e) => setIcp(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1">Location (optional)</label>
            <input
              className="input w-full"
              placeholder="e.g. United States, London"
              value={location}
              maxLength={80}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1">Buying signal (optional)</label>
            <input
              className="input w-full"
              placeholder='e.g. "recently funded", "hiring marketers"'
              value={signal}
              maxLength={80}
              onChange={(e) => setSignal(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={search}
            disabled={loading || !icp.trim()}
            className="btn-primary"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Finding leads…" : "Find leads"}
          </button>
          <p className="text-xs text-text-muted">Costs 50 credits per search</p>
        </div>
        {error && (
          <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {leads !== null && leads.length === 0 && (
        <p className="text-center text-sm text-text-muted py-6">
          No matching leads found. Try broadening your ICP description.
        </p>
      )}

      {leads && leads.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            {leads.length} leads scored · sorted by fit
          </p>
          {[...leads].sort((a, b) => b.fitScore - a.fitScore).map((lead, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text truncate">{lead.company}</p>
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text mt-0.5"
                  >
                    {lead.website.replace(/^https?:\/\/(www\.)?/, "").slice(0, 50)}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreColor(lead.fitScore)}`}>
                  {lead.fitScore}/10
                </span>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">{lead.fitReason}</p>

              <div className="rounded-md border border-bg-border bg-bg-elevated p-3">
                <p className="text-xs text-text-dim mb-1 uppercase tracking-wide">Outreach hook</p>
                <p className="text-sm leading-relaxed">{lead.hook}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => copyHook(`${i}`, lead.hook)}
                  className="btn-ghost text-xs gap-1.5"
                >
                  {copied === `${i}` ? (
                    <><Check className="h-3 w-3 text-green-400" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy hook</>
                  )}
                </button>
                <a
                  href={`/dashboard/outreach?prospect=${encodeURIComponent(lead.company + " — " + lead.hook)}`}
                  className="btn-ghost text-xs gap-1.5"
                >
                  <ArrowRight className="h-3 w-3" />
                  Draft outreach
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {leads === null && !loading && (
        <p className="text-center text-sm text-text-muted py-6">
          Describe your ideal customer and hit Find leads. Fortify searches the web and scores each result against your ICP.
        </p>
      )}
    </div>
  );
}
