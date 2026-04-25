"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

export function HookGenerator() {
  const [topic, setTopic] = useState("");
  const [hooks, setHooks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setHooks([]);
    try {
      const res = await fetch("/api/ai/hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generation failed");
      }
      const data = await res.json();
      setHooks(data.hooks);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="e.g. how to grow on TikTok in 2026"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          disabled={loading}
        />
        <button onClick={generate} disabled={loading || !topic.trim()} className="btn-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {hooks.length > 0 && (
        <ul className="space-y-2">
          {hooks.map((h, i) => (
            <li
              key={i}
              className="rounded-md border border-bg-border bg-bg-subtle px-3 py-2.5 text-sm"
            >
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
