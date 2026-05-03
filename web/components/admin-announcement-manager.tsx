"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Pencil, X, Check } from "lucide-react";

type Announcement = {
  id: string;
  message: string;
  expiresAt: string | null;
};

const DURATION_PRESETS = [
  { label: "No expiry",  value: "" },
  { label: "1 hour",     value: "1h" },
  { label: "6 hours",    value: "6h" },
  { label: "24 hours",   value: "24h" },
  { label: "3 days",     value: "3d" },
  { label: "7 days",     value: "7d" },
  { label: "Custom…",    value: "custom" },
];

function durationToDate(val: string): string | null {
  if (!val || val === "custom") return null;
  const now = Date.now();
  const map: Record<string, number> = {
    "1h":  1 * 3600_000,
    "6h":  6 * 3600_000,
    "24h": 24 * 3600_000,
    "3d":  3 * 86400_000,
    "7d":  7 * 86400_000,
  };
  return new Date(now + (map[val] ?? 0)).toISOString();
}

function formatExpiry(iso: string | null) {
  if (!iso) return "No expiry";
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return "Expired";
  const h = Math.floor(diff / 3600_000);
  if (h < 24) return `Expires in ${h}h`;
  return `Expires in ${Math.floor(h / 24)}d`;
}

export function AdminAnnouncementManager({ initial }: { initial: Announcement[] }) {
  const [list, setList] = useState<Announcement[]>(initial);
  const [msg, setMsg] = useState("");
  const [duration, setDuration] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editCustomDate, setEditCustomDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!msg.trim()) { setError("Message required"); return; }
    setError(null);
    setAdding(true);
    let expiresAt: string | null = null;
    if (duration === "custom") expiresAt = customDate ? new Date(customDate).toISOString() : null;
    else expiresAt = durationToDate(duration);

    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg.trim(), expiresAt }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setError(data.error ?? "Failed"); return; }
    setList((prev) => [...prev, data.announcement]);
    setMsg("");
    setDuration("");
    setCustomDate("");
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    setList((prev) => prev.filter((a) => a.id !== id));
    setBusy(false);
  }

  async function removeAll() {
    if (!confirm("Remove all announcements?")) return;
    setBusy(true);
    await fetch("/api/admin/announcements", { method: "DELETE" });
    setList([]);
    setBusy(false);
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setEditMsg(a.message);
    setEditDuration("");
    setEditCustomDate("");
  }

  async function saveEdit(id: string) {
    setBusy(true);
    let expiresAt: string | null | undefined = undefined;
    if (editDuration === "custom") expiresAt = editCustomDate ? new Date(editCustomDate).toISOString() : null;
    else if (editDuration) expiresAt = durationToDate(editDuration);

    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: editMsg.trim(), ...(expiresAt !== undefined ? { expiresAt } : {}) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return;
    setList((prev) => prev.map((a) => (a.id === id ? data.announcement : a)));
    setEditingId(null);
  }

  return (
    <div className="space-y-5">
      {/* Add form */}
      <div className="space-y-2">
        <textarea
          className="input w-full resize-none"
          rows={2}
          placeholder="Announcement message…"
          value={msg}
          maxLength={300}
          onChange={(e) => setMsg(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-auto"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            {DURATION_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {duration === "custom" && (
            <input
              type="datetime-local"
              className="input w-auto"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          )}
          <button
            onClick={add}
            disabled={adding}
            className="btn-primary text-sm"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add announcement
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Current announcements */}
      {list.length === 0 ? (
        <p className="text-sm text-text-muted">No active announcements.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Active ({list.length})
            </p>
            <button
              onClick={removeAll}
              disabled={busy}
              className="text-xs text-red-400 hover:text-red-300 transition"
            >
              Remove all
            </button>
          </div>

          {list.map((a) =>
            editingId === a.id ? (
              <div key={a.id} className="rounded-lg border border-bg-border bg-bg-elevated p-3 space-y-2">
                <textarea
                  className="input w-full resize-none text-sm"
                  rows={2}
                  value={editMsg}
                  maxLength={300}
                  onChange={(e) => setEditMsg(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    className="input w-auto text-sm"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                  >
                    <option value="">Keep existing expiry</option>
                    {DURATION_PRESETS.filter((p) => p.value !== "").map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  {editDuration === "custom" && (
                    <input
                      type="datetime-local"
                      className="input w-auto text-sm"
                      value={editCustomDate}
                      onChange={(e) => setEditCustomDate(e.target.value)}
                    />
                  )}
                  <button onClick={() => saveEdit(a.id)} disabled={busy} className="btn-primary text-xs py-1.5">
                    <Check className="h-3 w-3" /> Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1.5">
                    <X className="h-3 w-3" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-bg-border bg-bg-elevated px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{a.message}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{formatExpiry(a.expiresAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => startEdit(a)}
                    className="rounded p-1 text-text-muted transition hover:text-text"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(a.id)}
                    disabled={busy}
                    className="rounded p-1 text-text-muted transition hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
