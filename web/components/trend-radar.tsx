"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, RefreshCw, ExternalLink, ArrowUp, MessageSquare, Dna } from "lucide-react";
import type { Tier } from "@prisma/client";
import Link from "next/link";

type Term = { id: string; term: string; createdAt: string };

type WebResult = {
  title: string;
  url: string;
  description: string;
  age?: string;
  source?: string;
};

type RedditPost = {
  title: string;
  url: string;
  score: number;
  numComments: number;
  subreddit: string;
};

type Source = "web" | "reddit";

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
  tier,
}: {
  initialTerms: Term[];
  limit: number; // -1 = unlimited
  tier: Tier;
}) {
  const router = useRouter();
  const [terms, setTerms] = useState<Term[]>(initialTerms);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTermId, setActiveTermId] = useState<string | null>(
    initialTerms[0]?.id ?? null
  );
  const [source, setSource] = useState<Source>("web");
  const [freshness, setFreshness] = useState<Freshness>("pw");
  const [webResults, setWebResults] = useState<WebResult[] | null>(null);
  const [redditPosts, setRedditPosts] = useState<RedditPost[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [dnaInsight, setDnaInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const atCapacity = limit !== -1 && terms.length >= limit;
  const canReddit = tier === "ELITE" || tier === "APEX";

  const loadWebResults = useCallback(async (termId: string, fresh: Freshness) => {
    setResultsLoading(true);
    setWebResults(null);
    try {
      const res = await fetch(`/api/trends/search?termId=${termId}&freshness=${fresh}`);
      if (!res.ok) { setWebResults([]); setError(await res.text()); return; }
      const data = await res.json();
      setWebResults(data.results);
      setError(null);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const loadRedditPosts = useCallback(async (termId: string, fresh: Freshness) => {
    setResultsLoading(true);
    setRedditPosts(null);
    try {
      const res = await fetch(`/api/trends/reddit?termId=${termId}&freshness=${fresh}`);
      if (!res.ok) { setRedditPosts([]); setError(await res.text()); return; }
      const data = await res.json();
      setRedditPosts(data.posts);
      setError(null);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeTermId) return;
    setDnaInsight(null);
    if (source === "web") loadWebResults(activeTermId, freshness);
    else loadRedditPosts(activeTermId, freshness);
  }, [activeTermId, source, freshness, loadWebResults, loadRedditPosts]);

  function addTerm() {
    setError(null);
    if (draft.trim().length < 2) { setError("Term must be at least 2 chars"); return; }
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
        createdAt: typeof data.term.createdAt === "string"
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
        setWebResults(null);
        setRedditPosts(null);
      }
      router.refresh();
    });
  }

  function refresh() {
    if (!activeTermId) return;
    if (source === "web") loadWebResults(activeTermId, freshness);
    else loadRedditPosts(activeTermId, freshness);
  }

  async function loadInsight() {
    if (!activeTermId) return;
    setLoadingInsight(true);
    setDnaInsight(null);
    const results =
      source === "web"
        ? (webResults ?? [])
        : (redditPosts ?? []).map((p) => ({ title: p.title, description: `r/${p.subreddit}` }));
    const activeTerm = terms.find((t) => t.id === activeTermId);
    try {
      const res = await fetch("/api/trends/dna-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: activeTerm?.term ?? "", results }),
      });
      const data = await res.json();
      setDnaInsight(data.insight ?? null);
    } finally {
      setLoadingInsight(false);
    }
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
          <button onClick={addTerm} disabled={pending || atCapacity} className="btn-primary">
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

      {/* Term chips */}
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
                onClick={(e) => { e.stopPropagation(); removeTerm(t.id); }}
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

      {/* Source tabs + freshness + refresh */}
      {activeTermId && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bg-border pt-4">
          <div className="flex items-center gap-3">
            {/* Source selector */}
            <div className="flex rounded-md border border-bg-border overflow-hidden text-xs">
              <button
                onClick={() => setSource("web")}
                disabled={resultsLoading}
                className={`px-3 py-1.5 transition ${
                  source === "web"
                    ? "bg-white/10 text-white"
                    : "bg-bg-elevated text-text-muted hover:text-text"
                }`}
              >
                Web
              </button>
              {canReddit ? (
                <button
                  onClick={() => setSource("reddit")}
                  disabled={resultsLoading}
                  className={`px-3 py-1.5 transition border-l border-bg-border ${
                    source === "reddit"
                      ? "bg-white/10 text-white"
                      : "bg-bg-elevated text-text-muted hover:text-text"
                  }`}
                >
                  Reddit
                </button>
              ) : (
                <Link
                  href="/pricing"
                  className="border-l border-bg-border px-3 py-1.5 text-text-dim bg-bg-elevated hover:text-text-muted transition"
                  title="Upgrade to Elite to unlock Reddit signals"
                >
                  Reddit ↑
                </Link>
              )}
            </div>

            {/* Freshness pills */}
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
          </div>

          <button onClick={refresh} disabled={resultsLoading} className="btn-ghost text-xs">
            {resultsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        </div>
      )}

      {/* Results */}
      {activeTermId && (
        <div className="space-y-3">
          {resultsLoading && (
            <p className="text-center text-sm text-text-muted py-8">
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            </p>
          )}

          {/* Web results */}
          {!resultsLoading && source === "web" && webResults?.length === 0 && (
            <p className="text-center text-sm text-text-muted">No results in this window. Try widening the freshness.</p>
          )}
          {source === "web" && webResults?.map((r) => (
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
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">{r.description}</p>
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

          {/* Reddit results */}
          {!resultsLoading && source === "reddit" && redditPosts?.length === 0 && (
            <p className="text-center text-sm text-text-muted">No Reddit posts found. Try widening the freshness.</p>
          )}
          {source === "reddit" && redditPosts?.map((p) => (
            <a
              key={p.url}
              href={p.url}
              target="_blank"
              rel="noreferrer noopener"
              className="card block p-4 transition hover:border-bg-border/80 hover:bg-bg-panel"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{p.title}</p>
                  <p className="mt-2 flex items-center gap-3 text-[11px] text-text-dim">
                    <span className="text-text-muted">r/{p.subreddit}</span>
                    <span className="flex items-center gap-1">
                      <ArrowUp className="h-3 w-3" />
                      {p.score.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {p.numComments.toLocaleString()}
                    </span>
                  </p>
                </div>
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-text-dim" />
              </div>
            </a>
          ))}

          {/* Company DNA Insight (Elite+) */}
          {canReddit && (webResults?.length || redditPosts?.length) && (
            <div className="card p-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted flex items-center gap-1.5">
                  <Dna className="h-3.5 w-3.5 text-[var(--accent)]" /> Company DNA Insight
                </p>
                <button
                  onClick={loadInsight}
                  disabled={loadingInsight}
                  className="btn-ghost text-xs"
                >
                  {loadingInsight ? <Loader2 className="h-3 w-3 animate-spin" /> : "Get insight"}
                </button>
              </div>
              {dnaInsight && <p className="text-sm text-text leading-relaxed">{dnaInsight}</p>}
              {!dnaInsight && !loadingInsight && (
                <p className="text-xs text-text-muted">Get AI analysis of how this trend applies to your business.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
