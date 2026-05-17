"use client";

import { useState } from "react";
import { TierBadge } from "@/components/tier-badge";
import {
  Plus,
  X,
  Loader2,
  RefreshCw,
  Trash2,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

type WatchLink = {
  id: string;
  url: string;
  label: string;
  type: string;
  lastHash?: string;
  lastScanAt?: string;
};

type Scan = {
  id: string;
  url: string;
  hasChange: boolean;
  summary: string | null;
  scannedAt: string;
};

type Watch = {
  id: string;
  name: string;
  links: WatchLink[];
  active: boolean;
  creditsPaid: number;
  createdAt: string;
  scans: Scan[];
};

type NewLinkEntry = { url: string; label: string };

export function CompetitorWatchClient({
  watches: initialWatches,
  userCredits: initialCredits,
}: {
  watches: Watch[];
  userCredits: number;
}) {
  const [items, setItems] = useState<Watch[]>(initialWatches);
  const [credits, setCredits] = useState(initialCredits);
  const [showAdd, setShowAdd] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newLinks, setNewLinks] = useState<NewLinkEntry[]>([{ url: "", label: "" }]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetModal() {
    setNewName("");
    setNewLinks([{ url: "", label: "" }]);
    setError(null);
    setShowAdd(false);
  }

  function updateLink(index: number, field: keyof NewLinkEntry, value: string) {
    setNewLinks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addLinkRow() {
    if (newLinks.length >= 3) return;
    setNewLinks((prev) => [...prev, { url: "", label: "" }]);
  }

  function removeLinkRow(index: number) {
    setNewLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAddWatch() {
    setError(null);
    const name = newName.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    const validLinks = newLinks.filter((l) => l.url.trim().length > 0);
    if (validLinks.length === 0) {
      setError("At least one URL is required.");
      return;
    }
    if (credits < 25) {
      setError("Not enough credits. You need 25 credits to add a watch.");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/competitor-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, links: validLinks }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add watch.");
        return;
      }
      setItems((prev) => [data.watch, ...prev]);
      setCredits((c) => c - 25);
      resetModal();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleScan(watchId: string) {
    if (scanning) return;
    if (credits < 10) {
      setError("Not enough credits to scan. You need 10 credits.");
      return;
    }
    setScanning(watchId);
    setError(null);
    try {
      const res = await fetch(`/api/competitor-watch/${watchId}/scan`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scan failed.");
        return;
      }
      const newScans: Scan[] = data.scans ?? [];
      setItems((prev) =>
        prev.map((w) => {
          if (w.id !== watchId) return w;
          const merged = [...newScans, ...w.scans].slice(0, 5);
          return { ...w, scans: merged };
        })
      );
      setCredits((c) => c - (data.creditsUsed ?? 10));
    } catch {
      setError("Network error during scan.");
    } finally {
      setScanning(null);
    }
  }

  async function handleDelete(watchId: string) {
    if (!confirm("Delete this watch? This cannot be undone.")) return;
    setDeleting(watchId);
    setError(null);
    try {
      const res = await fetch(`/api/competitor-watch/${watchId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
        return;
      }
      setItems((prev) => prev.filter((w) => w.id !== watchId));
    } catch {
      setError("Network error.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActive(watch: Watch) {
    setToggling(watch.id);
    setError(null);
    try {
      const res = await fetch(`/api/competitor-watch/${watch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !watch.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update.");
        return;
      }
      setItems((prev) =>
        prev.map((w) => (w.id === watch.id ? { ...w, active: !w.active } : w))
      );
    } catch {
      setError("Network error.");
    } finally {
      setToggling(null);
    }
  }

  function ScanDots({ scans }: { scans: Scan[] }) {
    if (scans.length === 0) {
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-bg-border"
              title="No scan yet"
            />
          ))}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        {scans.map((s) => (
          <span
            key={s.id}
            className={`h-2.5 w-2.5 rounded-full ${
              s.hasChange ? "bg-amber-400" : "bg-emerald-500"
            }`}
            title={`${new Date(s.scannedAt).toLocaleString()} — ${s.summary ?? (s.hasChange ? "Changed" : "No change")}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Competitor Watch</h1>
            <TierBadge tier="ELITE" />
          </div>
          <p className="text-text-muted">
            Monitor competitor pages for content changes. Scan manually or let cron check them for you.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-muted tabular-nums">
            {credits.toLocaleString()} credits
          </span>
          <button
            onClick={() => { setShowAdd(true); setError(null); }}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Watch
          </button>
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !showAdd && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Globe className="h-10 w-10 text-text-dim mb-4" />
          <h3 className="font-semibold text-lg mb-1">No watches yet</h3>
          <p className="text-sm text-text-muted mb-6 max-w-sm">
            Add a competitor to start monitoring their pages for changes. Costs 25 credits per watch.
          </p>
          <button
            onClick={() => { setShowAdd(true); setError(null); }}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add your first watch
          </button>
        </div>
      )}

      {/* Watch cards */}
      <div className="space-y-4">
        {items.map((watch) => {
          const lastScan = watch.scans[0] ?? null;
          const isScanning = scanning === watch.id;
          const isDeleting = deleting === watch.id;
          const isToggling = toggling === watch.id;

          return (
            <div key={watch.id} className="card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Left: info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="font-semibold text-lg leading-tight">{watch.name}</h3>
                    {watch.active ? (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-bg-border/60 px-2 py-0.5 text-xs font-medium text-text-dim">
                        Paused
                      </span>
                    )}
                  </div>

                  {/* Links */}
                  <ul className="space-y-1 mb-3">
                    {watch.links.map((link) => (
                      <li key={link.id} className="flex items-center gap-2 text-sm text-text-muted">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-text-dim" />
                        <span className="font-medium text-text">{link.label || link.url}</span>
                        {link.label && (
                          <span className="truncate text-text-dim text-xs">{link.url}</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Scan history dots */}
                  <div className="flex items-center gap-3">
                    <ScanDots scans={watch.scans} />
                    {lastScan ? (
                      <span className="text-xs text-text-dim">
                        Last scan {new Date(lastScan.scannedAt).toLocaleDateString()} —{" "}
                        {lastScan.hasChange ? (
                          <span className="text-amber-400 font-medium">Changed</span>
                        ) : (
                          <span className="text-emerald-400">No change</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-text-dim">Not yet scanned</span>
                    )}
                  </div>

                  {/* Recent scan summaries */}
                  {watch.scans.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {watch.scans.slice(0, 3).map((s) => (
                        <div key={s.id} className="flex items-start gap-2 text-xs text-text-dim">
                          {s.hasChange ? (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                          )}
                          <span>
                            <span className="text-text-muted">{s.url.replace(/^https?:\/\//, "").slice(0, 50)}</span>
                            {" — "}
                            {s.summary ?? (s.hasChange ? "Content changed" : "No changes detected")}
                            {" · "}
                            {new Date(s.scannedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleScan(watch.id)}
                    disabled={isScanning || !watch.active}
                    title="Scan now (10 credits)"
                    className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isScanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {isScanning ? "Scanning…" : "Scan now"}
                  </button>

                  <button
                    onClick={() => handleToggleActive(watch)}
                    disabled={isToggling}
                    title={watch.active ? "Pause watch" : "Resume watch"}
                    className="btn-ghost p-2 disabled:opacity-50"
                  >
                    {isToggling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : watch.active ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleDelete(watch.id)}
                    disabled={isDeleting}
                    title="Delete watch"
                    className="btn-ghost p-2 text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Watch Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={resetModal}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-bg-border bg-bg-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Add Competitor Watch</h2>
              <button onClick={resetModal} className="btn-ghost p-1.5">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">
                  Competitor name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="input w-full"
                  maxLength={100}
                />
              </div>

              {/* Links */}
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">
                  Pages to monitor{" "}
                  <span className="text-text-dim font-normal">(up to 3)</span>
                </label>
                <div className="space-y-2">
                  {newLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateLink(i, "label", e.target.value)}
                        placeholder="Label (e.g. Pricing)"
                        className="input w-1/3"
                        maxLength={100}
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateLink(i, "url", e.target.value)}
                        placeholder="https://example.com/pricing"
                        className="input flex-1"
                        maxLength={500}
                      />
                      {newLinks.length > 1 && (
                        <button
                          onClick={() => removeLinkRow(i)}
                          className="btn-ghost p-1.5 text-text-dim hover:text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {newLinks.length < 3 && (
                  <button
                    onClick={addLinkRow}
                    className="mt-2 flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition"
                  >
                    <Plus className="h-4 w-4" />
                    Add another URL
                  </button>
                )}
              </div>

              {/* Cost notice */}
              <p className="text-xs text-text-dim">
                Adding a watch costs{" "}
                <span className="text-text-muted font-medium">25 credits</span>. You have{" "}
                <span className="text-text-muted font-medium tabular-nums">{credits.toLocaleString()}</span> credits.
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button onClick={resetModal} className="btn-ghost">
                  Cancel
                </button>
                <button
                  onClick={handleAddWatch}
                  disabled={adding || credits < 25}
                  className="btn-primary flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {adding ? "Adding…" : "Add Watch — 25 credits"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
