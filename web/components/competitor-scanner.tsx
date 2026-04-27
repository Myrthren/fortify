"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, RefreshCw, ExternalLink, Target } from "lucide-react";

type Report = {
  positioning: string;
  recentMoves: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  summary: string;
};

type Competitor = {
  id: string;
  name: string;
  url: string;
  lastReport: Report | null;
  lastScanned: string | null;
  createdAt: string;
};

export function CompetitorScanner({
  initial,
  limit,
}: {
  initial: Competitor[];
  limit: number; // -1 = unlimited
}) {
  const router = useRouter();
  const [list, setList] = useState<Competitor[]>(initial);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initial[0]?.id ?? null);

  const atCapacity = limit !== -1 && list.length >= limit;
  const open = list.find((c) => c.id === openId) ?? null;

  function add() {
    setError(null);
    if (name.trim().length < 1) {
      setError("Name required");
      return;
    }
    if (url.trim().length < 4) {
      setError("URL required");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(async () => ({ error: await res.text() }));
        setError(data.error ?? "Failed");
        return;
      }
      const data = await res.json();
      const c: Competitor = {
        id: data.competitor.id,
        name: data.competitor.name,
        url: data.competitor.url,
        lastReport: null,
        lastScanned: null,
        createdAt: new Date(data.competitor.createdAt).toISOString(),
      };
      setList([c, ...list]);
      setName("");
      setUrl("");
      setOpenId(c.id);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this competitor?")) return;
    startTransition(async () => {
      await fetch(`/api/competitors/${id}`, { method: "DELETE" });
      const next = list.filter((c) => c.id !== id);
      setList(next);
      if (openId === id) setOpenId(next[0]?.id ?? null);
      router.refresh();
    });
  }

  async function scan(id: string) {
    setScanningId(id);
    setError(null);
    try {
      const res = await fetch(`/api/competitors/${id}/scan`, { method: "POST" });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setList((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                lastReport: data.competitor.lastReport,
                lastScanned: data.competitor.lastScanned
                  ? new Date(data.competitor.lastScanned).toISOString()
                  : null,
              }
            : c
        )
      );
    } finally {
      setScanningId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add competitor */}
      <div className="card p-5">
        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
          Track a competitor
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="input sm:w-1/3"
            placeholder="Name (e.g. Vercel)"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            disabled={pending || atCapacity}
          />
          <input
            className="input flex-1"
            placeholder="vercel.com"
            value={url}
            maxLength={300}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            disabled={pending || atCapacity}
          />
          <button
            onClick={add}
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

      {/* Chips */}
      {list.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => setOpenId(c.id)}
              className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
                openId === c.id
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-bg-border bg-bg-elevated text-text-muted hover:text-text"
              }`}
            >
              {c.name}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  remove(c.id);
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

      {list.length === 0 && (
        <p className="text-center text-sm text-text-muted">
          Add your first competitor to start tracking.
        </p>
      )}

      {/* Detail panel */}
      {open && (
        <div className="space-y-5">
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{open.name}</p>
              <a
                href={open.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text"
              >
                {open.url}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              {open.lastScanned && (
                <span className="text-xs text-text-muted">
                  Last scanned {new Date(open.lastScanned).toLocaleString()}
                </span>
              )}
              <button
                onClick={() => scan(open.id)}
                disabled={scanningId === open.id}
                className="btn-secondary text-xs"
              >
                {scanningId === open.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {open.lastReport ? "Re-scan" : "Scan now"}
              </button>
            </div>
          </div>

          {scanningId === open.id && (
            <p className="text-center text-sm text-text-muted">
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              <span className="mt-2 block">
                Fetching site + searching news + analysing — usually 10-25 seconds…
              </span>
            </p>
          )}

          {open.lastReport && scanningId !== open.id && (
            <ReportView report={open.lastReport} />
          )}

          {!open.lastReport && scanningId !== open.id && (
            <div className="card p-8 text-center text-sm text-text-muted">
              <Target className="mx-auto h-5 w-5" />
              <p className="mt-3">Click "Scan now" to generate the first intel report.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">Positioning</p>
        <p className="mt-1 text-sm leading-relaxed">{report.positioning}</p>
      </div>

      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">Bottom line</p>
        <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
      </div>

      <Section title="Recent moves" items={report.recentMoves} accent="text-blue-300" />
      <Section title="Strengths" items={report.strengths} accent="text-green-400" />
      <Section title="Weaknesses" items={report.weaknesses} accent="text-orange-300" />

      <div className="card-elevated ring-1 ring-white/10 p-5">
        <p className="text-xs uppercase tracking-wide text-text-muted">
          Opportunities for you
        </p>
        <ol className="mt-2 space-y-2 text-sm">
          {report.opportunities.map((o, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
                {i + 1}
              </span>
              <span>{o}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Section({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  if (!items?.length) return null;
  return (
    <div className="card p-5">
      <p className={`text-xs uppercase tracking-wide ${accent}`}>{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-text-muted">·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
