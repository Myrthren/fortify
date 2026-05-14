"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Plus, Trash2, Zap, Youtube, Play, Facebook, RefreshCw,
  CheckCircle, Clock, XCircle, ExternalLink, Unplug, Calendar,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Platform = "tiktok" | "youtube" | "facebook";

type SocialConn = {
  platform: Platform;
  channelName: string | null;
  pageId: string | null;
};

type PlatformAnalysis = {
  score: number;
  verdict: string;
  suggestions: string[];
  tags: string[];
  bestTime: string;
  titleTweak: string | null;
};

type ViralityReport = {
  platforms: Partial<Record<Platform, PlatformAnalysis>>;
  summary: string;
  analyzedAt: string;
};

type MediaItem = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  category: string | null;
  targetPlatforms: Platform[];
  viralityReport: ViralityReport | null;
  analyzedAt: string | null;
  publishStatus: "DRAFT" | "ANALYZED" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  scheduledAt: string | null;
  publishedAt: string | null;
  publishResults: Record<Platform, { success: boolean; url?: string; error?: string }> | null;
  createdAt: string;
};

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  tiktok:   <Play className="h-3.5 w-3.5" />,
  youtube:  <Youtube className="h-3.5 w-3.5" />,
  facebook: <Facebook className="h-3.5 w-3.5" />,
};

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok:   "TikTok",
  youtube:  "YouTube",
  facebook: "Facebook",
};

const STATUS_COLORS = {
  DRAFT:      "text-text-muted",
  ANALYZED:   "text-blue-300",
  SCHEDULED:  "text-amber-300",
  PUBLISHING: "text-purple-300",
  PUBLISHED:  "text-green-400",
  FAILED:     "text-red-400",
};

const SCORE_COLOR = (n: number) =>
  n >= 8 ? "text-green-400" : n >= 6 ? "text-amber-300" : "text-red-400";

const CATEGORIES = [
  "Business", "Education", "Entertainment", "Comedy", "Lifestyle",
  "Fitness", "Food", "Travel", "Tech", "Finance", "Gaming", "Beauty", "Music",
];

// ── Main component ─────────────────────────────────────────────────────────────

export function ViralityEngine({
  initialConnections,
  canAutoPublish,
}: {
  initialConnections: SocialConn[];
  canAutoPublish: boolean;
}) {
  const [connections, setConnections] = useState<SocialConn[]>(initialConnections);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [view, setView] = useState<"pool" | "detail">("pool");

  // Add video form
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addPlatforms, setAddPlatforms] = useState<Platform[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    setLoadingItems(true);
    try {
      const res = await fetch("/api/media");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {}
    finally { setLoadingItems(false); }
  }

  async function addItem() {
    setAddError(null);
    if (!addTitle.trim()) { setAddError("Title required"); return; }
    if (!addUrl.trim()) { setAddError("Video URL required"); return; }
    if (!addPlatforms.length) { setAddError("Select at least one platform"); return; }

    setAddLoading(true);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle,
          videoUrl: addUrl,
          description: addDesc || null,
          category: addCategory || null,
          targetPlatforms: addPlatforms,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? "Failed"); return; }
      setItems((prev) => [data.item, ...prev]);
      setAddTitle(""); setAddUrl(""); setAddDesc(""); setAddCategory(""); setAddPlatforms([]);
      setShowAdd(false);
      openItem(data.item);
    } catch { setAddError("Request failed"); }
    finally { setAddLoading(false); }
  }

  async function deleteItem(id: string) {
    if (!confirm("Remove this video from the pool?")) return;
    await fetch(`/api/media/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selected?.id === id) { setSelected(null); setView("pool"); }
  }

  function openItem(item: MediaItem) {
    setSelected(item);
    setView("detail");
  }

  function patchItem(id: string, patch: Partial<MediaItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    if (selected?.id === id) setSelected((s) => s ? { ...s, ...patch } : s);
  }

  function togglePlatform(p: Platform) {
    setAddPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function disconnectPlatform(platform: Platform) {
    if (!confirm(`Disconnect ${PLATFORM_LABELS[platform]}?`)) return;
    await fetch("/api/social/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    setConnections((prev) => prev.filter((c) => c.platform !== platform));
  }

  const connectedPlatforms = connections.map((c) => c.platform);

  return (
    <div className="space-y-6">
      {/* ── Platform connections ── */}
      <div className="card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Connected platforms
        </p>
        <div className="flex flex-wrap gap-3">
          {(["tiktok", "youtube", "facebook"] as Platform[]).map((platform) => {
            const conn = connections.find((c) => c.platform === platform);
            return conn ? (
              <div
                key={platform}
                className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-sm"
              >
                {PLATFORM_ICONS[platform]}
                <span className="font-medium">{conn.channelName ?? PLATFORM_LABELS[platform]}</span>
                <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                <button
                  onClick={() => disconnectPlatform(platform)}
                  className="text-text-dim hover:text-red-300 transition"
                >
                  <Unplug className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <a
                key={platform}
                href={`/api/social/connect?platform=${platform}`}
                className="flex items-center gap-2 rounded-lg border border-bg-border bg-bg-elevated px-3 py-2 text-sm text-text-muted hover:text-text transition"
              >
                {PLATFORM_ICONS[platform]}
                Connect {PLATFORM_LABELS[platform]}
                <Plus className="h-3.5 w-3.5" />
              </a>
            );
          })}
        </div>
        {canAutoPublish && (
          <p className="mt-3 text-xs text-purple-300 flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            Apex — auto-publish enabled
          </p>
        )}
      </div>

      {view === "pool" ? (
        <>
          {/* ── Add video ── */}
          {showAdd ? (
            <div className="card p-5 space-y-3">
              <p className="text-sm font-semibold">Add video to pool</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Title</label>
                  <input className="input w-full" placeholder="My viral hook video" value={addTitle} onChange={(e) => setAddTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Category</label>
                  <select className="input w-full" value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Video URL <span className="text-text-dim">(direct link — Dropbox, Drive, etc.)</span>
                </label>
                <input className="input w-full font-mono text-xs" placeholder="https://..." value={addUrl} onChange={(e) => setAddUrl(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Description <span className="text-text-dim">(optional)</span></label>
                <textarea className="input w-full resize-none" rows={2} placeholder="What the video is about…" value={addDesc} onChange={(e) => setAddDesc(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Target platforms</label>
                <div className="flex gap-2">
                  {(["tiktok", "youtube", "facebook"] as Platform[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition ${
                        addPlatforms.includes(p)
                          ? "border-white/30 bg-white/10 text-text"
                          : "border-bg-border text-text-muted hover:text-text"
                      }`}
                    >
                      {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
              {addError && <p className="text-xs text-red-300">{addError}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={addItem} disabled={addLoading} className="btn-primary text-sm">
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add to pool
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="btn-secondary w-full text-sm">
              <Plus className="h-4 w-4" /> Add video to pool
            </button>
          )}

          {/* ── Media pool grid ── */}
          {loadingItems ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : items.length === 0 ? (
            <div className="card p-12 text-center space-y-2 text-text-muted">
              <Zap className="mx-auto h-6 w-6" />
              <p className="text-sm">Your media pool is empty.</p>
              <p className="text-xs">Add a video to get AI virality scoring and platform-optimised publishing.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onOpen={() => openItem(item)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : selected ? (
        <MediaDetail
          item={selected}
          connections={connections}
          canAutoPublish={canAutoPublish}
          onBack={() => setView("pool")}
          onPatch={(patch) => patchItem(selected.id, patch)}
        />
      ) : null}
    </div>
  );
}

// ── Media card ────────────────────────────────────────────────────────────────

function MediaCard({
  item, onOpen, onDelete,
}: { item: MediaItem; onOpen: () => void; onDelete: () => void }) {
  const report = item.viralityReport;
  const scores = report ? Object.values(report.platforms).map((p) => p!.score) : [];
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <div
      onClick={onOpen}
      className="card group cursor-pointer p-4 hover:bg-bg-elevated transition space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate text-sm">{item.title}</p>
          {item.category && (
            <p className="text-xs text-text-muted">{item.category}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {avgScore !== null && (
            <span className={`text-sm font-bold tabular-nums ${SCORE_COLOR(avgScore)}`}>
              {avgScore.toFixed(1)}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-text-dim hover:text-red-300 transition opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {item.targetPlatforms.map((p) => (
            <span key={p} className="text-text-muted">{PLATFORM_ICONS[p]}</span>
          ))}
        </div>
        <StatusPill status={item.publishStatus} scheduledAt={item.scheduledAt} />
      </div>
    </div>
  );
}

// ── Media detail ──────────────────────────────────────────────────────────────

function MediaDetail({
  item, connections, canAutoPublish, onBack, onPatch,
}: {
  item: MediaItem;
  connections: SocialConn[];
  canAutoPublish: boolean;
  onBack: () => void;
  onPatch: (patch: Partial<MediaItem>) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  async function analyze() {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch(`/api/media/${item.id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setAnalyzeError(data.error ?? "Failed"); return; }
      onPatch({ viralityReport: data.report, analyzedAt: data.report.analyzedAt, publishStatus: "ANALYZED" });
    } catch { setAnalyzeError("Request failed"); }
    finally { setAnalyzing(false); }
  }

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/media/${item.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: item.targetPlatforms }),
      });
      const data = await res.json();
      if (!res.ok) { setPublishError(data.error ?? "Failed"); return; }
      onPatch({
        publishStatus: "PUBLISHED",
        publishedAt: new Date().toISOString(),
        publishResults: data.results,
      });
    } catch { setPublishError("Request failed"); }
    finally { setPublishing(false); }
  }

  async function scheduleOptimal() {
    setScheduling(true);
    setScheduleError(null);
    try {
      const res = await fetch(`/api/media/${item.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useOptimal: true }),
      });
      const data = await res.json();
      if (!res.ok) { setScheduleError(data.error ?? "Failed"); return; }
      onPatch({ publishStatus: "SCHEDULED", scheduledAt: data.scheduledAt });
    } catch { setScheduleError("Request failed"); }
    finally { setScheduling(false); }
  }

  async function cancelSchedule() {
    await fetch(`/api/media/${item.id}/schedule`, { method: "DELETE" });
    onPatch({ publishStatus: "ANALYZED", scheduledAt: null });
  }

  const report = item.viralityReport;
  const connectedPlatforms = connections.map((c) => c.platform);
  const missingConnections = item.targetPlatforms.filter((p) => !connectedPlatforms.includes(p));

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-xs text-text-muted hover:text-text transition">
          ← Pool
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{item.title}</p>
          {item.category && <p className="text-xs text-text-muted">{item.category}</p>}
        </div>
        <StatusPill status={item.publishStatus} scheduledAt={item.scheduledAt} />
      </div>

      {/* Missing connections warning */}
      {missingConnections.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Connect {missingConnections.map((p) => PLATFORM_LABELS[p]).join(", ")} to publish to {missingConnections.length === 1 ? "this platform" : "these platforms"}.
        </div>
      )}

      {/* Analyse button */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Virality Analysis</p>
          {item.analyzedAt && (
            <p className="text-xs text-text-muted">
              Last analysed {new Date(item.analyzedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={analyze} disabled={analyzing} className="btn-secondary text-xs">
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {item.viralityReport ? "Re-analyse" : "Analyse"}
        </button>
      </div>

      {analyzeError && <ErrorBox msg={analyzeError} />}

      {analyzing && (
        <div className="flex flex-col items-center gap-2 py-8 text-sm text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Pulling platform trends + AI scoring — usually 15–30 seconds…</span>
        </div>
      )}

      {/* Report */}
      {report && !analyzing && (
        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wide text-text-muted">Overall verdict</p>
            <p className="mt-1 text-sm leading-relaxed">{report.summary}</p>
          </div>

          {item.targetPlatforms.map((platform) => {
            const p = report.platforms[platform];
            if (!p) return null;
            return (
              <div key={platform} className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {PLATFORM_ICONS[platform]}
                    <p className="text-sm font-semibold">{PLATFORM_LABELS[platform]}</p>
                  </div>
                  <span className={`text-2xl font-bold tabular-nums ${SCORE_COLOR(p.score)}`}>
                    {p.score}<span className="text-sm font-normal text-text-muted">/10</span>
                  </span>
                </div>
                <p className="text-sm text-text-muted">{p.verdict}</p>

                {p.titleTweak && (
                  <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                    <p className="text-xs text-blue-300 mb-0.5">Suggested title</p>
                    <p className="text-sm">{p.titleTweak}</p>
                  </div>
                )}

                {p.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-text-muted mb-1.5">To improve virality:</p>
                    <ul className="space-y-1">
                      {p.suggestions.map((s, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-text-muted shrink-0">·</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((tag) => (
                      <span key={tag} className="rounded-md border border-bg-border bg-bg px-2 py-0.5 text-xs text-text-muted">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-text-muted flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Best time: {p.bestTime}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Publish controls */}
      {(item.viralityReport || item.publishStatus === "DRAFT") && (
        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold">Publish</p>

          {item.publishStatus === "PUBLISHED" && (
            <div className="space-y-2">
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Published {item.publishedAt ? new Date(item.publishedAt).toLocaleString() : ""}
              </p>
              {item.publishResults && Object.entries(item.publishResults).map(([platform, result]) => (
                <div key={platform} className="flex items-center justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1.5">
                    {PLATFORM_ICONS[platform as Platform]}
                    {PLATFORM_LABELS[platform as Platform]}
                    {result.success ? <CheckCircle className="h-3 w-3 text-green-400" /> : <XCircle className="h-3 w-3 text-red-400" />}
                  </span>
                  {result.url && (
                    <a href={result.url} target="_blank" rel="noreferrer" className="hover:text-text transition">
                      View <ExternalLink className="inline h-3 w-3" />
                    </a>
                  )}
                  {result.error && <span className="text-red-400">{result.error}</span>}
                </div>
              ))}
            </div>
          )}

          {item.publishStatus === "SCHEDULED" && item.scheduledAt && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-amber-300 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Scheduled for {new Date(item.scheduledAt).toLocaleString()}
              </p>
              <button onClick={cancelSchedule} className="text-xs text-text-muted hover:text-text transition">
                Cancel
              </button>
            </div>
          )}

          {item.publishStatus !== "PUBLISHED" && item.publishStatus !== "SCHEDULED" && item.publishStatus !== "PUBLISHING" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={publish}
                disabled={publishing || !item.viralityReport}
                className="btn-primary text-sm"
                title={!item.viralityReport ? "Analyse first to get optimised tags" : undefined}
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Publish now
              </button>

              {canAutoPublish && (
                <button
                  onClick={scheduleOptimal}
                  disabled={scheduling || !item.viralityReport}
                  className="btn-secondary text-sm"
                >
                  {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                  Schedule optimal time
                </button>
              )}
            </div>
          )}

          {publishError && <ErrorBox msg={publishError} />}
          {scheduleError && <ErrorBox msg={scheduleError} />}
        </div>
      )}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status, scheduledAt }: { status: MediaItem["publishStatus"]; scheduledAt: string | null }) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    ANALYZED: "Analysed",
    SCHEDULED: "Scheduled",
    PUBLISHING: "Publishing…",
    PUBLISHED: "Published",
    FAILED: "Failed",
  };
  return (
    <span className={`text-xs font-medium ${STATUS_COLORS[status]}`}>
      {labels[status] ?? status}
    </span>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
      {msg}
    </div>
  );
}
