"use client";
import { useCallback, useRef, useState, type ComponentType } from "react";
import { Sparkles } from "lucide-react";

type PanelProps = { visible?: boolean; hideLauncher?: boolean; onClose?: () => void };
export function FortifyAILauncher({ inline = false }: { inline?: boolean }) {
  const [Panel, setPanel] = useState<ComponentType<PanelProps> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false), [visible, setVisible] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setVisible(false); trigger.current?.focus(); }, []);
  async function open() {
    if (busy) return;
    if (Panel) { setVisible(true); return; }
    setBusy(true); setError(false);
    try {
      const { FortifyAI } = await import("./fortify-ai");
      setPanel(() => FortifyAI); setVisible(true);
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <>
    <button ref={trigger} type="button" className={inline ? "workspace-ai-launcher" : "fortify-ai-launcher"} onClick={() => void open()} disabled={busy} aria-busy={busy} aria-expanded={visible} aria-haspopup="dialog" aria-label={error ? "Chat could not load. Retry Fortify AI" : "Ask Fortify AI"}>
      <Sparkles size={16} aria-hidden="true"/><span>{busy ? "Opening…" : error ? "Retry chat" : inline ? "Ask Fortify" : "Fortify AI"}</span>
    </button>
    {Panel && <Panel visible={visible} hideLauncher onClose={close}/>}
  </>;
}
