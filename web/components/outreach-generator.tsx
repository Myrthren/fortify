"use client";

import { useState } from "react";
import { Loader2, Send, Copy, Check } from "lucide-react";

type Channel = "dm" | "email" | "linkedin" | "cold-email";

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "dm", label: "Twitter DM" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
  { value: "cold-email", label: "Cold sales" },
];

export function OutreachGenerator() {
  const [channel, setChannel] = useState<Channel>("dm");
  const [prospect, setProspect] = useState("");
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, prospect, offer }),
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(async () => ({ error: await res.text() }));
        throw new Error(data.error ?? "Generation failed");
      }
      const data = await res.json();
      setMessage(data.message);
      setVoice(data.voice ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
          Channel
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              onClick={() => setChannel(c.value)}
              disabled={loading}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                channel === c.value
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-bg-border bg-bg-elevated text-text-muted hover:text-text"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
          Prospect (who they are)
        </label>
        <p className="mt-1 mb-2 text-xs text-text-muted">
          Paste their bio, role, recent post, or anything specific about them.
        </p>
        <textarea
          className="input min-h-[100px] text-sm"
          placeholder="e.g. CTO at series-A fintech, recently posted about hiring engineers from non-CS backgrounds. ~20k Twitter followers."
          value={prospect}
          onChange={(e) => setProspect(e.target.value)}
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
          Your ask / offer
        </label>
        <textarea
          className="input mt-2 min-h-[80px] text-sm"
          placeholder="e.g. I built a tool that helps eng teams hire from bootcamps with 80% retention. Want to show you a demo?"
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          disabled={loading}
        />
      </div>

      <button
        onClick={generate}
        disabled={loading || prospect.length < 20 || offer.length < 10}
        className="btn-primary"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Write outreach
      </button>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="space-y-2">
          {voice && (
            <p className="text-xs text-text-muted">
              In voice: <span className="text-text">{voice}</span>
            </p>
          )}
          <div className="card-elevated relative p-4">
            <button
              onClick={copy}
              className="absolute right-3 top-3 rounded-md border border-bg-border bg-bg-panel/80 p-1.5 text-text-muted backdrop-blur transition hover:text-text"
              title="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <pre className="whitespace-pre-wrap pr-10 font-sans text-sm leading-relaxed">{message}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
