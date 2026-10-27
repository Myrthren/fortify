"use client";
import { useState, type ComponentType } from "react";
import { Sparkles } from "lucide-react";

export function FortifyAILauncher() {
  const [Panel, setPanel] = useState<ComponentType<{ initiallyOpen: boolean }> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  async function open() {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const { FortifyAI } = await import("./fortify-ai");
      setPanel(() => FortifyAI);
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  if (Panel) return <Panel initiallyOpen />;
  return <button type="button" className="fortify-ai-launcher" onClick={() => void open()} disabled={busy} aria-busy={busy}>
    <Sparkles size={15} aria-hidden="true" />
    <span role="status">{busy ? "Opening chat…" : error ? "Chat could not load. Retry" : "Fortify AI"}</span>
  </button>;
}
