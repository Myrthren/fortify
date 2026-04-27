"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, RefreshCw, ExternalLink } from "lucide-react";

type Term = { id: string; term: string; createdAt: string };
type Result = {
  title: string;
  url: string;
  description: string;
  age?: string;
  source?: string;
  favicon?: string;
};

type Freshness = "pd" | "pw" | "pm" | "py";
const FRESHNESS_LABELS: Record<Freshness, string> = {
  pd: "24h",
  pw: "7d",
  pm: "30d",
  py: "1y",
};

export function TrendRadar({
  initialTerms,
  limit,
}: {
  initialTerms: Term[];
  limit: number; // -1 = unlimited
}) {
  const router = useRouter();
  const [terms, setTerms] = useState<Term[]>(initialTerms);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTermId, setActiveTermId] = useState<string | null>(
    initialTerms[0]?.id ?? null
  );
  const [freshness, setFreshness] = useState<Freshness>("pw");
  const [results, setResults] = useState<Result[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const atCapacity = limit !== -1 && terms.length >= limit;

  const loadResults = useCallback(
    async (termId: string, fresh: Freshness) => {
      setResultsLoading(true);
      setResults(null);
      try {
        const res = await fetch(
          `/api/trends/search?termId=${termId}&freshness=${fresh}`
        );
        if (!res.ok) {
          setResults([]);
          setError(await res.text());
          return;
        }
        const data = await res.json();
        setResults(data.results);
        setError(null);
      } finally {
        setResultsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeTermId) loadResults(activeTermId, freshness);
  }, [activeTermId, freshness, loadResults]);

  function addTerm() {
    setError(null);
    if (draft.trim().length < 2) {
      setError("Term must be at least 2 chars");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/trends/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(async () => ({ error: await res.text() }));
        setError(data.error ?? "Failed to add");
        return;
      }
      const data = await res.json();
      const newTerm = {
        ...data.term,
        createdAt:
          typeof data.term.createdAt === "string"
            ? data.term.createdAt
            : new Date(data.term.createdAt).toISOString(),
      };
      if (!data.deduped) {
        setTerms([newTerm, ...terms]);
        setActiveTermId(newTerm.id);
      }
      setDraft("");
      router.refresh();
    });
  }

  function removeTerm(id: string) {
    if (!confirm("Remove this watch term?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/trends/watch/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const next = terms.filter((t) => t.id !== id);
      setTerms(next);
      if (activeTermId === id) {
        setActiveTermId(next[0]?.id ?? null);
        setResults(null);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Add term */}
      <div className="card p-5">
        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
          Add a topic
        </label>
        <p className="mt-1 mb-3 text-xs text-text-muted">
          E.g. "AI agent frameworks", "creator tools 2026", "fractional CTO market".
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="Topic to track"
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTerm()}
            disabled={pending || atCapacity}
          />
          <button
            onClick={addTerm}
            disabled={pending || atCapacity}
            className="btn-primary"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {atCapacity ? "Limit reached" : "Track"}
          </button>
        </div>
        {error && (
          <div className="mt-3 rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Term list (chips) */}
      {terms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {terms.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTermId(t.id)}
              className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
                activeTermId === t.id
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-bg-border bg-bg-elevated text-text-muted hover:text-text"
              }`}
            >
              {t.term}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeTerm(t.id);
                }}
                className="text-text-dim hover:text-red-300"
                role="button"
                aria-label="remove"
              >
                <Trash2 className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      )}

      {terms.length === 0 && (
        <p className="text-center text-sm text-text-muted">
          Add your first topic above to start tracking.
        </p>
      )}

      {/* Freshness + refresh */}
      {activeTermId && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bg-border pt-4">
          <div className="flex gap-1">
            {(Object.keys(FRESHNESS_LABELS) as Freshness[]).map((f) => (
              <button
                key={f}
                onClick={() => setFreshness(f)}
                disabled={resultsLoading}
                className={`rounded-md border px-2.5 py-1 text-xs transition ${
                  freshness === f
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-bg-border bg-bg-elevated text-text-muted hover:text-text"
                }`}
              >
                {FRESHNESS_LABELS[f]}
              </button>
            ))}
          </div>
          <button
            onClick={() => loadResults(activeTermId, freshness)}
            disabled={resultsLoading}
            className="btn-ghost text-xs"
          >
            {resultsLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </button>
        </div>
      )}

      {/* Results */}
      {activeTermId && (
        <div className="space-y-3">
          {resultsLoading && (
            <p className="text-center text-sm text-text-muted">
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            </p>
          )}
          {!resultsLoading && results?.length === 0 && (
            <p className="text-center text-sm text-text-muted">
              No results in this window. Try widening the freshness.
            </p>
          )}
          {results?.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="card block p-4 transition hover:border-bg-border/80 hover:bg-bg-panel"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                    {r.description}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-[11px] text-text-dim">
                    {r.source && <span>{r.source}</span>}
                    {r.source && r.age && <span>·</span>}
                    {r.age && <span>{r.age}</span>}
                  </p>
                </div>
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-text-dim" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
