"use client";

import { useState } from "react";
import {
  Plus, Play, Pause, Trash2, ChevronRight,
  Zap, X, Loader2, ShoppingCart, CheckCircle2, Clock,
  AlertCircle,
} from "lucide-react";

type CapacityDisplay = {
  used: number;
  total: number | null;
  remaining: number | null;
  pct: number;
  isUnlimited: boolean;
};

type CapPack = {
  id: string;
  label: string;
  description: string;
  price: string;
};

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  runCount: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
};

export function WorkflowsClient({
  capacity: initialCapacity,
  packs,
  workflows: initialWorkflows,
  tier,
}: {
  capacity: CapacityDisplay;
  packs: CapPack[];
  workflows: WorkflowRow[];
  tier: string;
}) {
  const [capacity,   setCapacity]   = useState(initialCapacity);
  const [workflows,  setWorkflows]  = useState(initialWorkflows);
  const [showBuy,    setShowBuy]    = useState(false);
  const [buying,     setBuying]     = useState<string | null>(null);
  const [showNew,    setShowNew]    = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newDesc,    setNewDesc]    = useState("");
  const [creating,   setCreating]   = useState(false);
  const [toggling,   setToggling]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  const barColor = (p: number) =>
    p > 90 ? "bg-red-500" : p > 70 ? "bg-amber-400" : "bg-emerald-500";

  async function buyPack(pack: CapPack) {
    setBuying(pack.id);
    try {
      const r = await fetch("/api/workflows/capacity/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });
      const d = await r.json();
      if (d.approveUrl) {
        window.location.href = d.approveUrl;
      } else {
        alert(d.error ?? "Failed to start checkout.");
      }
    } finally {
      setBuying(null);
    }
  }

  async function createWorkflow() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });
      if (r.ok) {
        const d = await r.json();
        setWorkflows((prev) => [d.workflow, ...prev]);
        setShowNew(false);
        setNewName("");
        setNewDesc("");
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleWorkflow(id: string, active: boolean) {
    setToggling(id);
    try {
      const r = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (r.ok) {
        setWorkflows((prev) =>
          prev.map((w) => (w.id === id ? { ...w, active: !active } : w))
        );
      }
    } finally {
      setToggling(null);
    }
  }

  async function deleteWorkflow(id: string) {
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function statusIcon(status: string | null) {
    if (!status) return null;
    if (status === "completed") return <CheckCircle2 className="h-3 w-3 text-emerald-400" />;
    if (status === "running")   return <Loader2 className="h-3 w-3 animate-spin text-blue-400" />;
    if (status === "failed")    return <AlertCircle className="h-3 w-3 text-red-400" />;
    return <Clock className="h-3 w-3 text-text-dim" />;
  }

  return (
    <div className="space-y-8">

      {/* ── Capacity card ── */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Workflow Capacity</p>
            {capacity.isUnlimited ? (
              <p className="text-xs text-text-muted">
                Unlimited capacity on your Apex plan.
              </p>
            ) : (
              <p className="text-xs text-text-muted">
                {capacity.used.toLocaleString()} units used ·{" "}
                {capacity.remaining?.toLocaleString()} remaining (rolling 30 days)
              </p>
            )}
          </div>
          {!capacity.isUnlimited && (
            <button
              onClick={() => setShowBuy(true)}
              className="btn-secondary text-xs shrink-0"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Buy capacity
            </button>
          )}
        </div>

        {!capacity.isUnlimited && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className={`h-full rounded-full transition-all ${barColor(capacity.pct)}`}
                style={{ width: `${capacity.pct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-text-dim">
              <span>0</span>
              <span>{capacity.pct}%</span>
              <span>{capacity.total?.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Workflows list ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your Workflows</h2>
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs">
            <Plus className="h-3.5 w-3.5" /> New workflow
          </button>
        </div>

        {workflows.length === 0 ? (
          <div className="card p-10 text-center">
            <Zap className="mx-auto mb-3 h-8 w-8 text-text-dim" />
            <p className="text-sm font-medium mb-1">No workflows yet</p>
            <p className="text-xs text-text-muted mb-4">
              Create your first automation to get started.
            </p>
            <button onClick={() => setShowNew(true)} className="btn-secondary text-sm">
              <Plus className="h-4 w-4" /> Create workflow
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {workflows.map((w) => (
              <div key={w.id} className="card p-4 flex items-center gap-4">
                <div
                  className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border ${
                    w.active
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-bg-border bg-bg-elevated"
                  }`}
                >
                  <Zap className={`h-4 w-4 ${w.active ? "text-emerald-400" : "text-text-dim"}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{w.name}</p>
                  {w.description && (
                    <p className="text-xs text-text-muted truncate">{w.description}</p>
                  )}
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-dim">
                    <span>{w.runCount} runs</span>
                    {w.lastRunAt && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          {statusIcon(w.lastRunStatus)}
                          Last {new Date(w.lastRunAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleWorkflow(w.id, w.active)}
                    disabled={toggling === w.id}
                    title={w.active ? "Pause workflow" : "Activate workflow"}
                    className="rounded-md p-1.5 text-text-muted transition hover:bg-white/[0.04] hover:text-text disabled:opacity-40"
                  >
                    {toggling === w.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : w.active ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <a
                    href={`/dashboard/workflows/${w.id}`}
                    className="rounded-md p-1.5 text-text-muted transition hover:bg-white/[0.04] hover:text-text"
                    title="Open workflow"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => deleteWorkflow(w.id)}
                    disabled={deleting === w.id}
                    title="Delete workflow"
                    className="rounded-md p-1.5 text-text-muted transition hover:bg-white/[0.04] hover:text-red-300 disabled:opacity-40"
                  >
                    {deleting === w.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Buy capacity modal ── */}
      {showBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="card-elevated w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">Buy workflow capacity</h3>
              <button onClick={() => setShowBuy(false)} className="text-text-muted hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-text-muted mb-5">
              Extra capacity never expires — use it any time.
            </p>
            <div className="space-y-3">
              {packs.map((p) => (
                <div key={p.id} className="card p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">{p.label}</p>
                    <p className="text-xs text-text-muted">{p.description}</p>
                  </div>
                  <button
                    onClick={() => buyPack(p)}
                    disabled={buying !== null}
                    className="btn-primary text-sm shrink-0"
                  >
                    {buying === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      `£${p.price}`
                    )}
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] text-text-dim text-center">
              Secure checkout via PayPal
            </p>
          </div>
        </div>
      )}

      {/* ── New workflow modal ── */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="card-elevated w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Create workflow</h3>
              <button onClick={() => setShowNew(false)} className="text-text-muted hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Weekly content brief"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createWorkflow()}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Description (optional)</label>
                <input
                  className="input"
                  placeholder="What does this workflow do?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowNew(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={createWorkflow}
                disabled={!newName.trim() || creating}
                className="btn-primary flex-1"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
