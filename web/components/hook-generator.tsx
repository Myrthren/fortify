"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

export function HookGenerator() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("TikTok / Reels");
  const [hooks, setHooks] = useState<string[]>([]);
  const [voice, setVoice] = useState<string | null>(null);
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
        body: JSON.stringify({ topic, platform }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generation failed");
      }
      const data = await res.json();
      setHooks(data.hooks);
      setVoice(data.voice ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input"
          placeholder="e.g. how to grow on TikTok in 2026"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          disabled={loading}
        />
        <select className="input sm:max-w-40" value={platform} onChange={(e) => setPlatform(e.target.value)} disabled={loading}>
          <option>TikTok / Reels</option><option>YouTube Shorts</option><option>LinkedIn</option><option>X / Twitter</option><option>Email subject line</option>
        </select>
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
        <div>
          {voice && (
            <p className="mb-2 text-xs text-text-muted">
              Generated in voice: <span className="text-text">{voice}</span>
            </p>
          )}
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
        </div>
      )}
    </div>
  );
}
