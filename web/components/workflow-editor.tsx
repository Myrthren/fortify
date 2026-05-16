"use client";

import { useState } from "react";
import {
  ArrowLeft, Save, Play, Pause, Trash2, Loader2,
  CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronRight,
  Zap, Plus, X,
} from "lucide-react";
import Link from "next/link";

type WorkflowRun = {
  id: string;
  status: string;
  usedCapacity: number;
  startedAt: string;
  completedAt: string | null;
  log: { nodeId?: string; type?: string; status?: string; output?: string; timestamp?: string }[];
};

type WorkflowNode = {
  id: string;
  type: string;
  label: string;
  config?: Record<string, string>;
};

type Workflow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  nodes: WorkflowNode[];
  runs: WorkflowRun[];
};

const NODE_TYPES = [
  { type: "trigger_schedule", label: "Schedule trigger", icon: "⏰", desc: "Run on a cron schedule" },
  { type: "trigger_webhook", label: "Webhook trigger", icon: "🔗", desc: "Run when a URL is called" },
  { type: "ai_generate", label: "AI generate", icon: "✦", desc: "Generate text with AI" },
  { type: "ai_summarise", label: "AI summarise", icon: "📝", desc: "Summarise content with AI" },
  { type: "action_discord", label: "Discord post", icon: "💬", desc: "Post to a Discord channel" },
  { type: "action_email", label: "Send email", icon: "📧", desc: "Send an email" },
  { type: "action_webhook", label: "Webhook out", icon: "📤", desc: "POST data to a URL" },
] as const;

function statusBadge(status: string) {
  if (status === "completed") return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Completed</span>;
  if (status === "running")   return <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">Running</span>;
  if (status === "failed")    return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">Failed</span>;
  return <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-text-muted">{status}</span>;
}

function runDuration(run: WorkflowRun): string {
  if (!run.completedAt) return "—";
  const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function WorkflowEditor({ workflow: initial }: { workflow: Workflow }) {
  const [workflow,    setWorkflow]    = useState(initial);
  const [name,        setName]        = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [saving,      setSaving]      = useState(false);
  const [toggling,    setToggling]    = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [dirty,       setDirty]       = useState(false);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, nodes: workflow.nodes }),
      });
      if (r.ok) { setDirty(false); }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setToggling(true);
    try {
      const r = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !workflow.active }),
      });
      if (r.ok) setWorkflow((w) => ({ ...w, active: !w.active }));
    } finally {
      setToggling(false);
    }
  }

  function addNode(type: string, label: string) {
    const node: WorkflowNode = {
      id: Math.random().toString(36).slice(2),
      type,
      label,
      config: {},
    };
    setWorkflow((w) => ({ ...w, nodes: [...w.nodes, node] }));
    setShowAddNode(false);
    setDirty(true);
  }

  function removeNode(id: string) {
    setWorkflow((w) => ({ ...w, nodes: w.nodes.filter((n) => n.id !== id) }));
    setDirty(true);
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start gap-4 flex-wrap">
        <Link href="/dashboard/workflows" className="btn-ghost p-2 mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <input
            className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-text-dim"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            placeholder="Workflow name"
          />
          <input
            className="mt-1 w-full bg-transparent text-sm text-text-muted outline-none placeholder:text-text-dim"
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
            placeholder="Description (optional)"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleActive}
            disabled={toggling}
            className="btn-secondary text-sm"
          >
            {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : workflow.active ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Activate</>}
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="btn-primary text-sm disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-3.5 w-3.5" /> Save</>}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Node builder ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Nodes</h2>
            <button onClick={() => setShowAddNode(true)} className="btn-ghost text-xs">
              <Plus className="h-3.5 w-3.5" /> Add node
            </button>
          </div>

          {workflow.nodes.length === 0 ? (
            <div className="card p-8 text-center">
              <Zap className="mx-auto mb-3 h-7 w-7 text-text-dim" />
              <p className="text-sm text-text-muted mb-3">No nodes yet.</p>
              <button onClick={() => setShowAddNode(true)} className="btn-secondary text-sm">
                <Plus className="h-4 w-4" /> Add first node
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {workflow.nodes.map((node, i) => {
                const meta = NODE_TYPES.find((n) => n.type === node.type);
                return (
                  <div key={node.id} className="card p-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-base">
                      {meta?.icon ?? "⚙️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{node.label}</p>
                      <p className="text-[10px] text-text-dim">{meta?.desc ?? node.type}</p>
                    </div>
                    <span className="text-[10px] text-text-dim shrink-0">#{i + 1}</span>
                    <button
                      onClick={() => removeNode(node.id)}
                      className="text-text-dim hover:text-red-300 transition shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add node picker */}
          {showAddNode && (
            <div className="card-elevated p-4 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Choose a node</p>
                <button onClick={() => setShowAddNode(false)} className="text-text-dim hover:text-text">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {NODE_TYPES.map((n) => (
                <button
                  key={n.type}
                  onClick={() => addNode(n.type, n.label)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.04]"
                >
                  <span className="text-base">{n.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-[10px] text-text-muted">{n.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Run history ── */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Run history</h2>

          {workflow.runs.length === 0 ? (
            <div className="card p-8 text-center">
              <Clock className="mx-auto mb-3 h-7 w-7 text-text-dim" />
              <p className="text-sm text-text-muted">No runs yet.</p>
              <p className="text-xs text-text-dim mt-1">Activate the workflow to start running it.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workflow.runs.map((run) => (
                <div key={run.id} className="card overflow-hidden">
                  <button
                    className="flex w-full items-center gap-3 p-3 text-left"
                    onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                  >
                    <span className="shrink-0">
                      {run.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                      {run.status === "failed"    && <AlertCircle   className="h-4 w-4 text-red-400" />}
                      {run.status === "running"   && <Loader2       className="h-4 w-4 animate-spin text-blue-400" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {statusBadge(run.status)}
                        <span className="text-[10px] text-text-dim">{runDuration(run)}</span>
                        <span className="text-[10px] text-text-dim">{run.usedCapacity} units</span>
                      </div>
                      <p className="text-[10px] text-text-dim mt-0.5">
                        {new Date(run.startedAt).toLocaleString()}
                      </p>
                    </div>
                    {expandedRun === run.id
                      ? <ChevronDown className="h-3.5 w-3.5 text-text-dim shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-text-dim shrink-0" />}
                  </button>

                  {expandedRun === run.id && run.log.length > 0 && (
                    <div className="border-t border-bg-border bg-bg-subtle px-3 py-2 space-y-1">
                      {run.log.map((entry, i) => (
                        <div key={i} className="flex gap-2 text-[10px]">
                          <span className={
                            entry.status === "ok"      ? "text-emerald-400" :
                            entry.status === "error"   ? "text-red-400"     :
                                                         "text-text-dim"
                          }>
                            {entry.type ?? "log"}
                          </span>
                          <span className="text-text-muted truncate">{entry.output ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
