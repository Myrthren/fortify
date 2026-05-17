"use client";

import { useState } from "react";
import { Search, Loader2, ExternalLink, MapPin, Globe } from "lucide-react";
import { TierBadge } from "@/components/tier-badge";

type Lead = {
  title: string;
  url: string;
  description: string;
  source?: string;
};

type PastSearch = {
  id: string;
  location: string;
  category: string | null;
  totalLeads: number;
  createdAt: string;
};

interface ReconClientProps {
  pastSearches: PastSearch[];
  userCredits: number;
}

export function ReconClient({ pastSearches, userCredits }: ReconClientProps) {
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState(userCredits);
  const [localPastSearches, setLocalPastSearches] = useState<PastSearch[]>(pastSearches);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim() || !category.trim()) return;

    setError(null);
    setLoading(true);
    setResults([]);

    try {
      const res = await fetch("/api/recon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: location.trim(), category: category.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setResults(data.leads ?? []);
      setCredits((c) => c - 50);

      const newSearch: PastSearch = {
        id: data.searchId,
        location: location.trim(),
        category: category.trim(),
        totalLeads: (data.leads ?? []).length,
        createdAt: new Date().toISOString(),
      };
      setLocalPastSearches((prev) => [newSearch, ...prev].slice(0, 10));
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function domainFromUrl(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Fortify Recon</h1>
            <TierBadge tier="ELITE" />
          </div>
          <p className="mt-2 text-text-muted">
            Find local businesses in any area and category — ready to prospect.
          </p>
        </div>
        <span className="w-fit rounded-md border border-bg-border bg-bg-panel px-3 py-1.5 text-sm tabular-nums">
          {credits.toLocaleString()} credits
        </span>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="card p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
              Location
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input
                className="input w-full pl-9"
                placeholder="e.g. Manchester, Birmingham"
                value={location}
                maxLength={120}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
              Business category
            </label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input
                className="input w-full pl-9"
                placeholder="e.g. plumbers, dentists, solicitors"
                value={category}
                maxLength={120}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading || !location.trim() || !category.trim()}
            className="btn-primary"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Searching…" : "Search · 50 credits"}
          </button>
          <p className="text-xs text-text-muted">
            Returns up to 20 businesses per search
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((lead, i) => (
              <div key={i} className="card-elevated p-4 space-y-2">
                <p className="text-[11px] text-text-dim truncate">
                  {lead.source ?? domainFromUrl(lead.url)}
                </p>
                <a
                  href={lead.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block font-medium text-text leading-snug hover:underline"
                >
                  {lead.title}
                </a>
                {lead.description && (
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
                    {lead.description}
                  </p>
                )}
                <div className="pt-1">
                  <a
                    href={lead.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-secondary inline-flex items-center gap-1.5 text-xs py-1 px-2.5"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Visit
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past searches */}
      {localPastSearches.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Past Searches
          </h2>
          <div className="card divide-y divide-bg-border overflow-hidden">
            {localPastSearches.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setLocation(s.location);
                  setCategory(s.category ?? "");
                  setResults([]);
                  setError(null);
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-white/[0.03]"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-text-dim" />
                  <span className="font-medium text-text truncate">
                    {s.location}
                  </span>
                  {s.category && (
                    <>
                      <span className="text-text-dim">·</span>
                      <span className="text-text-muted truncate">{s.category}</span>
                    </>
                  )}
                </span>
                <span className="ml-4 shrink-0 flex items-center gap-3 text-xs text-text-dim">
                  <span>{s.totalLeads} leads</span>
                  <span className="hidden sm:inline">{formatDate(s.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
