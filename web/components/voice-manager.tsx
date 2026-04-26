"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Check, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

type Voice = {
  id: string;
  name: string;
  isActive: boolean;
  systemPrompt: string;
  createdAt: string;
};

export function VoiceManager({
  initialVoices,
  tier,
  limit,
}: {
  initialVoices: Voice[];
  tier: string;
  limit: number; // -1 = unlimited
}) {
  const [voices, setVoices] = useState<Voice[]>(initialVoices);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [samples, setSamples] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const atCapacity = limit !== -1 && voices.length >= limit;
  const canCreate = tier !== "FREE" && !atCapacity;

  function reset() {
    setName("");
    setSamples("");
    setError(null);
    setCreating(false);
  }

  async function create() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Give your voice a name (min 2 chars)");
      return;
    }
    if (samples.length < 200) {
      setError("Need at least 200 chars of writing samples");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, samples }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = await res.json();
      setVoices([data.voice, ...voices]);
      reset();
      router.refresh();
    });
  }

  async function setActive(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/ai/voice/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        setVoices(voices.map((v) => ({ ...v, isActive: v.id === id })));
        router.refresh();
      }
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this voice? This can't be undone.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/ai/voice/${id}`, { method: "DELETE" });
      if (res.ok) {
        setVoices(voices.filter((v) => v.id !== id));
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Free tier upsell */}
      {tier === "FREE" && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
          <h3 className="font-semibold">Brand Voice is a Pro feature</h3>
          <p className="mt-1 text-sm text-text-muted">
            Train Claude on your writing for outputs that sound like you, not generic AI.
          </p>
          <Link href="/pricing" className="btn-primary mt-4 w-fit">Upgrade to Pro</Link>
        </div>
      )}

      {/* Create form */}
      {tier !== "FREE" && (
        <div className="card p-6">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              disabled={atCapacity}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              {atCapacity ? "Voice limit reached" : "New brand voice"}
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
                  Voice name
                </label>
                <input
                  className="input mt-1"
                  placeholder="e.g. casual twitter, professional linkedin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
                  Writing samples ({samples.length} chars)
                </label>
                <p className="mt-1 mb-2 text-xs text-text-muted">
                  Paste 5-10 of your best posts/tweets/captions, separated by --- (three dashes). The more variety, the better the voice.
                </p>
                <textarea
                  className="input min-h-[260px] font-mono text-xs"
                  placeholder={"Building in public works because...\n---\nThe best founders I know all do one thing...\n---\n..."}
                  value={samples}
                  onChange={(e) => setSamples(e.target.value)}
                  disabled={pending}
                />
              </div>
              {error && (
                <div className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={create} disabled={pending} className="btn-primary">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Train voice
                </button>
                <button onClick={reset} disabled={pending} className="btn-secondary">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-text-muted">Training takes ~5-10 seconds.</p>
            </div>
          )}
        </div>
      )}

      {/* Voice list */}
      {voices.length > 0 && (
        <div className="space-y-3">
          {voices.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              onSetActive={setActive}
              onDelete={remove}
              disabled={pending}
            />
          ))}
        </div>
      )}

      {voices.length === 0 && tier !== "FREE" && !creating && (
        <p className="text-center text-sm text-text-muted">
          No voices yet. Train your first to make every generation sound like you.
        </p>
      )}
    </div>
  );
}

function VoiceCard({
  voice,
  onSetActive,
  onDelete,
  disabled,
}: {
  voice: Voice;
  onSetActive: (id: string) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  return (
    <div
      className={`p-5 ${
        voice.isActive
          ? "card-elevated ring-1 ring-white/15"
          : "card"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{voice.name}</h3>
            {voice.isActive && (
              <span className="rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Trained {new Date(voice.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {!voice.isActive && (
            <button
              onClick={() => onSetActive(voice.id)}
              disabled={disabled}
              className="btn-ghost text-xs"
            >
              Set active
            </button>
          )}
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="btn-ghost text-xs"
            title={showPrompt ? "Hide" : "View"}
          >
            {showPrompt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onDelete(voice.id)}
            disabled={disabled}
            className="btn-ghost text-xs text-red-300 hover:text-red-200"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showPrompt && (
        <pre className="mt-4 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-md border border-bg-border bg-bg-subtle p-3 font-mono text-xs leading-relaxed text-text-muted">
          {voice.systemPrompt}
        </pre>
      )}
    </div>
  );
}
