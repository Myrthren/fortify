"use client";

import { useState, useRef } from "react";
import { Loader2, Sparkles, ArrowUp, Lock, TrendingUp } from "lucide-react";
import type { Tier } from "@prisma/client";
import Link from "next/link";

type InspirationPost = {
  hook: string;
  angle: string;
  format: string;
  source: { title: string; url: string; score?: number };
};

type CommentInsight = {
  painPoint: string;
  desire: string;
  contentAngle: string;
  evidence: string;
};

type AdFrame = {
  hook: string;
  angle: string;
  ctaPattern: string;
  format: string;
  spendSignal: string;
};

type Tab = "posts" | "comments" | "ads";

export function ContentInspiration({
  defaultNiche,
  tier,
}: {
  defaultNiche: string;
  tier: Tier;
}) {
  const [tab, setTab] = useState<Tab>("posts");
  const [niche, setNiche] = useState(defaultNiche);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<InspirationPost[] | null>(null);
  const [comments, setComments] = useState<CommentInsight[] | null>(null);
  const [adFrames, setAdFrames] = useState<AdFrame[] | null>(null);
  const adsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canComments = tier === "ELITE" || tier === "APEX";
  const canAds = tier === "ELITE" || tier === "APEX";

  async function run() {
    if (!niche.trim() || niche.trim().length < 2) {
      setError("Enter a niche (min 2 chars).");
      return;
    }
    setError(null);

    if (tab === "ads") {
      runAdIntel();
      return;
    }

    setLoading(true);
    if (tab === "posts") setPosts(null);
    else setComments(null);

    const endpoint = tab === "posts" ? "/api/inspiration/posts" : "/api/inspiration/comments";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      if (tab === "posts") setPosts(data.results);
      else setComments(data.insights);
    } catch {
      setError("Request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function runAdIntel() {
    setLoading(true);
    setAdFrames(null);
    try {
      const res = await fetch("/api/inspiration/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setLoading(false); return; }

      const { runId } = data as { runId: string };

      if (adsPollRef.current) clearInterval(adsPollRef.current);
      adsPollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/inspiration/ads?runId=${runId}`);
          const pollData = await pollRes.json();

          if (pollData.status === "running") return;

          clearInterval(adsPollRef.current!);
          adsPollRef.current = null;
          setLoading(false);

          if (pollData.status === "succeeded" && pollData.frames) {
            setAdFrames(pollData.frames);
          } else {
            setError(pollData.error ?? "Ad Intel scan failed. Try again.");
          }
        } catch {
          clearInterval(adsPollRef.current!);
          adsPollRef.current = null;
          setLoading(false);
          setError("Lost connection while polling. Try again.");
        }
      }, 5000);
    } catch {
      setError("Request failed. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Niche input */}
      <div className="card p-5">
        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
          Your niche
        </label>
        <p className="mt-1 mb-3 text-xs text-text-muted">
          E.g. "SaaS founder", "e-commerce apparel", "freelance copywriting".
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="Enter your niche"
            value={niche}
            maxLength={80}
            onChange={(e) => setNiche(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && run()}
            disabled={loading}
          />
          <button onClick={run} disabled={loading || !niche.trim()} className="btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Scanning…" : "Find inspiration"}
          </button>
        </div>
        {error && (
          <div className="mt-3 rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-bg-border">
        <button
          onClick={() => setTab("posts")}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            tab === "posts"
              ? "border-white text-text"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          Top Posts
          <span className="ml-1.5 rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
            Pro+
          </span>
        </button>
        <button
          onClick={() => canComments && setTab("comments")}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 ${
            tab === "comments"
              ? "border-white text-text"
              : canComments
              ? "border-transparent text-text-muted hover:text-text"
              : "border-transparent text-text-dim cursor-default"
          }`}
        >
          {!canComments && <Lock className="h-3 w-3" />}
          Comment Intel
          <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
            Elite+
          </span>
        </button>
        <button
          onClick={() => canAds && setTab("ads")}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 ${
            tab === "ads"
              ? "border-white text-text"
              : canAds
              ? "border-transparent text-text-muted hover:text-text"
              : "border-transparent text-text-dim cursor-default"
          }`}
        >
          {!canAds && <Lock className="h-3 w-3" />}
          Ad Intel
          <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
            Elite+
          </span>
        </button>
      </div>

      {/* Upgrade notice for Comment Intel */}
      {tab === "comments" && !canComments && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <p className="text-sm font-medium">Comment Intel is an Elite+ feature</p>
          <p className="mt-1 text-xs text-text-muted">
            Analyse YouTube video data to surface what your audience is really struggling with.
          </p>
          <Link href="/pricing" className="btn-primary mt-4 w-fit text-sm">Upgrade to Elite</Link>
        </div>
      )}

      {/* Upgrade notice for Ad Intel */}
      {tab === "ads" && !canAds && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <p className="text-sm font-medium">Ad Intel is an Elite+ feature</p>
          <p className="mt-1 text-xs text-text-muted">
            Extract winning ad frameworks from Meta's Ad Library — hooks, angles, CTA patterns, and spend signals.
          </p>
          <Link href="/pricing" className="btn-primary mt-4 w-fit text-sm">Upgrade to Elite</Link>
        </div>
      )}

      {/* Top Posts results */}
      {tab === "posts" && posts && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            {posts.length} content angles from top Reddit posts in <span className="text-text">{niche}</span>
          </p>
          {posts.map((p, i) => (
            <div key={i} className="card p-4 space-y-2">
              <p className="text-sm font-semibold text-text">"{p.hook}"</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-text-muted">
                  {p.angle}
                </span>
                <span className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-text-muted">
                  {p.format}
                </span>
              </div>
              {p.source.url && (
                <a
                  href={p.source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 text-[11px] text-text-dim hover:text-text-muted transition"
                >
                  <ArrowUp className="h-3 w-3" />
                  {p.source.score != null ? `${p.source.score.toLocaleString()} · ` : ""}{p.source.title}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Comment Intel results */}
      {tab === "comments" && canComments && comments && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            {comments.length} pain points from top YouTube content in <span className="text-text">{niche}</span>
          </p>
          {comments.map((c, i) => (
            <div key={i} className="card p-4 space-y-2">
              <p className="text-sm font-semibold text-text">{c.painPoint}</p>
              <p className="text-xs text-text-muted">
                <span className="text-text-dim">Desire: </span>{c.desire}
              </p>
              <p className="text-xs text-text-muted">
                <span className="text-text-dim">Angle: </span>{c.contentAngle}
              </p>
              <p className="mt-1 text-[11px] text-text-dim italic border-l-2 border-bg-border pl-3">
                {c.evidence}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Ad Intel loading */}
      {tab === "ads" && canAds && loading && (
        <div className="flex flex-col items-center gap-2 py-8 text-sm text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Scraping Meta Ad Library — usually 30-60 seconds…</span>
        </div>
      )}

      {/* Ad Intel results */}
      {tab === "ads" && canAds && adFrames && !loading && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            {adFrames.length} winning ad frameworks in <span className="text-text">{niche}</span> from Meta Ad Library
          </p>
          {adFrames.map((f, i) => (
            <div key={i} className="card p-4 space-y-2">
              <p className="text-sm font-semibold text-text">"{f.hook}"</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-text-muted">
                  {f.angle}
                </span>
                <span className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-text-muted">
                  {f.format}
                </span>
                <span className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-purple-300">
                  CTA: {f.ctaPattern}
                </span>
              </div>
              {f.spendSignal && (
                <p className="text-[11px] text-amber-300/80 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {f.spendSignal}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty states */}
      {tab === "posts" && !loading && !posts && (
        <p className="text-center text-sm text-text-muted py-6">
          Enter your niche and hit Find inspiration to see what content angles are working right now.
        </p>
      )}
      {tab === "comments" && canComments && !loading && !comments && (
        <p className="text-center text-sm text-text-muted py-6">
          Enter your niche and hit Find inspiration to surface audience pain points from YouTube.
        </p>
      )}
      {tab === "ads" && canAds && !loading && !adFrames && (
        <p className="text-center text-sm text-text-muted py-6">
          Enter your niche and hit Find inspiration to extract winning ad frameworks from Meta.
        </p>
      )}
    </div>
  );
}
