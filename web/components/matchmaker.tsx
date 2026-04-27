"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Sparkles, Copy, Check, ExternalLink, Lock } from "lucide-react";

type Match = {
  userId: string;
  score: number;
  why: string;
  theyHelpYou: string;
  youHelpThem: string;
  starter: string;
  name: string;
  image: string | null;
  tier: string;
  niche: string | null;
  socials: Record<string, string> | null;
};

const SOCIAL_DISPLAY: Record<string, { label: string; url: (v: string) => string }> = {
  twitter: { label: "Twitter", url: (v) => (v.startsWith("http") ? v : `https://x.com/${v.replace(/^@/, "")}`) },
  linkedin: { label: "LinkedIn", url: (v) => (v.startsWith("http") ? v : `https://${v}`) },
  github: { label: "GitHub", url: (v) => (v.startsWith("http") ? v : `https://${v}`) },
  instagram: { label: "Instagram", url: (v) => (v.startsWith("http") ? v : `https://instagram.com/${v.replace(/^@/, "")}`) },
  youtube: { label: "YouTube", url: (v) => (v.startsWith("http") ? v : `https://${v}`) },
  tiktok: { label: "TikTok", url: (v) => (v.startsWith("http") ? v : `https://tiktok.com/@${v.replace(/^@/, "")}`) },
  website: { label: "Website", url: (v) => (v.startsWith("http") ? v : `https://${v}`) },
};

export function Matchmaker() {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [empty, setEmpty] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    setError(null);
    setEmpty(null);
    setMatches(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/match", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(async () => ({ error: await res.text() }));
        throw new Error(data.error ?? "Match failed");
      }
      const data = await res.json();
      if (data.empty) {
        setEmpty(data.empty);
      } else {
        setMatches(data.matches ?? []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-text-muted" />
        <p className="mt-3 text-sm text-text-muted">
          We'll analyse every other member's profile against yours.
        </p>
        <button onClick={find} disabled={loading} className="btn-primary mt-4 w-fit mx-auto">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {matches ? "Re-run match" : "Find my matches"}
        </button>
        {loading && (
          <p className="mt-3 text-xs text-text-muted">Reading profiles + ranking — usually 5-10 seconds…</p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {empty && (
        <div className="card p-5 text-center text-sm text-text-muted">{empty}</div>
      )}

      {matches && matches.length === 0 && (
        <div className="card p-5 text-center text-sm text-text-muted">
          No strong matches found yet. As more members fill out their profiles, this will get better.
        </div>
      )}

      <div className="space-y-3">
        {matches?.map((m) => (
          <MatchCard key={m.userId} match={m} />
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const [copied, setCopied] = useState(false);
  async function copyStarter() {
    await navigator.clipboard.writeText(match.starter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <Avatar name={match.name} image={match.image} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{match.name}</p>
            <TierBadge tier={match.tier} />
            <span className="ml-auto rounded border border-bg-border bg-bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
              {match.score}/100
            </span>
          </div>
          {match.niche && (
            <p className="mt-0.5 truncate text-xs text-text-muted">{match.niche}</p>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed">{match.why}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-bg-border bg-bg-subtle p-3">
          <p className="text-xs uppercase tracking-wide text-text-muted">They help you</p>
          <p className="mt-1 text-sm">{match.theyHelpYou}</p>
        </div>
        <div className="rounded-md border border-bg-border bg-bg-subtle p-3">
          <p className="text-xs uppercase tracking-wide text-text-muted">You help them</p>
          <p className="mt-1 text-sm">{match.youHelpThem}</p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-white/15 bg-white/[0.03] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-text-muted">Conversation starter</p>
            <p className="mt-1 text-sm italic">"{match.starter}"</p>
          </div>
          <button
            onClick={copyStarter}
            className="rounded-md border border-bg-border bg-bg-panel/80 p-1.5 text-text-muted hover:text-text"
            title="Copy"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {match.socials !== null ? (
        Object.keys(match.socials).length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-bg-border pt-3 text-xs">
            <span className="text-text-muted">Reach out:</span>
            {Object.entries(match.socials).map(([k, v]) => {
              const def = SOCIAL_DISPLAY[k];
              if (!def) return null;
              return (
                <a
                  key={k}
                  href={def.url(v)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-text hover:bg-bg-panel"
                >
                  {def.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 border-t border-bg-border pt-3 text-xs text-text-muted">
            No socials shared.
          </p>
        )
      ) : (
        <div className="mt-4 flex items-center gap-2 border-t border-bg-border pt-3 text-xs text-text-muted">
          <Lock className="h-3 w-3" /> Upgrade to see contact info.{" "}
          <Link href="/pricing" className="text-text underline-offset-4 hover:underline">
            View plans →
          </Link>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return <Image src={image} alt={name} width={40} height={40} className="rounded-full" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-sm font-semibold text-text-muted">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === "FREE") return null;
  const cls =
    {
      PRO: "border-blue-500/40 bg-blue-500/10 text-blue-200",
      ELITE: "border-purple-500/40 bg-purple-500/10 text-purple-200",
      APEX: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
    }[tier] ?? "border-bg-border";
  return (
    <span
      className={`rounded border px-1 py-0 text-[9px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {tier}
    </span>
  );
}
