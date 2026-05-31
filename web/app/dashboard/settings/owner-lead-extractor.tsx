"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function OwnerLeadExtractorSettings({ initialRaiseBatch }: { initialRaiseBatch: boolean }) {
  const [raiseBatch, setRaiseBatch] = useState(initialRaiseBatch);
  const [saving, setSaving] = useState(false);

  async function update(value: boolean) {
    setSaving(true);
    setRaiseBatch(value); // optimistic
    try {
      const res = await fetch("/api/lead-extractor/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leRaiseBatch: value }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRaiseBatch(data.leRaiseBatch);
    } catch {
      setRaiseBatch(!value); // revert
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Lead Extractor (Owner)
      </h2>
      <div className="card divide-y divide-bg-border">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Raise batch limit</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Process up to 500 accounts per run instead of the standard cap — fewer, larger passes for bulk
              lead harvesting. Owner-only; not shown to members.
            </p>
          </div>
          <button
            disabled={saving}
            onClick={() => update(!raiseBatch)}
            role="switch"
            aria-checked={raiseBatch}
            className={`ml-4 shrink-0 relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
              raiseBatch ? "bg-white" : "bg-white/20"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-bg shadow-sm transition-transform ${
                raiseBatch ? "translate-x-4" : "translate-x-0"
              }`}
            />
            {saving && (
              <Loader2 className="absolute -right-5 top-0 h-4 w-4 animate-spin text-text-dim" />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
