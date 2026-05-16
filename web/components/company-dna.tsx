"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Brain, Loader2 } from "lucide-react";
import Link from "next/link";

type DnaEntry = {
  id: string;
  label: string;
  content: string;
  chars: number;
  createdAt: string;
};

export function CompanyDna({ tier }: { tier: string }) {
  const [entries, setEntries] = useState<DnaEntry[]>([]);
  const [totalChars, setTotalChars] = useState(0);
  const [limit, setLimit] = useState(0);
  const [canUse, setCanUse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/company-dna")
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setTotalChars(d.totalChars ?? 0);
        setLimit(d.limit ?? 0);
        setCanUse(d.canUse ?? false);
        setLoading(false);
      });
  }, []);

  async function addEntry() {
    if (!label.trim() || !content.trim()) {
      setError("Both label and content are required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/company-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, content }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setEntries((prev) => [...prev, data.entry]);
      setTotalChars(data.totalChars);
      setLabel("");
      setContent("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    if (!confirm("Remove this from your Company DNA? Fortify AI will forget this context.")) return;
    const res = await fetch("/api/company-dna", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTotalChars(data.totalChars);
    }
  }

  const pct = limit > 0 && limit < 999999 ? Math.min(100, Math.round((totalChars / limit) * 100)) : 0;
  const isUnlimited = limit >= 999999;

  if (!canUse) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-5 w-5 text-yellow-400" />
          <h3 className="font-semibold">Company DNA</h3>
        </div>
        <p className="text-sm text-text-muted mb-4">
          Tell Fortify AI everything about your business. It will remember your context and give personalised advice. Available on Pro+.
        </p>
        <Link href="/pricing" className="btn-primary w-fit">Upgrade to Pro</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Memory bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-text-muted" />
            <span className="text-sm font-medium">Memory</span>
          </div>
          <span className="text-xs text-text-muted">
            {totalChars.toLocaleString()} / {isUnlimited ? "∞" : limit.toLocaleString()} chars
          </span>
        </div>
        {!isUnlimited && (
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
            <div
              className={`h-full rounded-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-400" : "bg-green-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <p className="mt-2 text-xs text-text-muted">
          {isUnlimited ? "Unlimited memory (Apex)" : `£1 = 2,000 memory. Remove entries to free up space.`}
        </p>
      </div>

      {/* Add entry */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add context
        </button>
      ) : (
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">Label</label>
            <input
              className="input w-full"
              placeholder="e.g. Business model, Target audience, Key products..."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1">Content</label>
            <textarea
              className="input w-full min-h-[100px]"
              placeholder="e.g. We sell B2B SaaS to e-commerce brands doing £500k+ revenue. Our main product is a returns analytics dashboard..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="mt-1 text-xs text-text-muted">{(label + content).length} chars</p>
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex gap-2">
            <button onClick={addEntry} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save to DNA
            </button>
            <button onClick={() => { setShowForm(false); setError(null); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-text-muted" /></div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-text-muted py-6">No context added yet. Tell Fortify AI about your business.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <div key={e.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{e.label}</p>
                  <p className="mt-1 text-xs text-text-muted whitespace-pre-wrap line-clamp-3">{e.content}</p>
                  <p className="mt-2 text-[10px] text-text-dim">{e.chars.toLocaleString()} chars · Added {new Date(e.createdAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => removeEntry(e.id)}
                  className="shrink-0 text-text-dim hover:text-red-300 transition"
                  title="Remove from memory"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
