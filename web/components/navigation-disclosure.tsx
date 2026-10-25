"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

// The links and account permissions remain server-rendered. This small boundary
// owns only disclosure behaviour, including touch and keyboard navigation.
export function NavigationDisclosure({ label, icon, active = false, placement = "left", className = "", children }: { label: string; icon?: ReactNode; active?: boolean; placement?: "left" | "right" | "mobile"; className?: string; children: ReactNode }) {
  const id = useId(), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), focusFirst = useRef(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const other = (event: Event) => { if ((event as CustomEvent).detail !== id) setOpen(false); };
    window.addEventListener("fortify:navigation-open", other);
    return () => window.removeEventListener("fortify:navigation-open", other);
  }, [id]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    if (placement === "mobile") document.body.style.overflow = "hidden";
    const fitPanel = () => { const panel = root.current?.querySelector<HTMLElement>(".workspace-disclosure-panel"); if (panel) panel.style.maxHeight = `${Math.max(0, window.innerHeight - panel.getBoundingClientRect().top - 12)}px`; };
    fitPanel();
    window.dispatchEvent(new CustomEvent("fortify:navigation-open", { detail: id }));
    if (focusFirst.current) { root.current?.querySelector<HTMLElement>(".workspace-disclosure-panel a, .workspace-disclosure-panel button")?.focus(); focusFirst.current = false; }
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const resize = () => { if (placement === "mobile" ? window.innerWidth > 1050 : window.innerWidth <= 1050) setOpen(false); else fitPanel(); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); window.addEventListener("resize", resize);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); window.removeEventListener("resize", resize); if (placement === "mobile") document.body.style.overflow = previousOverflow; };
  }, [open, id, placement]);
  return <div ref={root} className={`workspace-disclosure workspace-disclosure-${placement} ${className}`} data-open={open} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} type="button" className={`workspace-disclosure-trigger ${active ? "is-active" : ""}`} aria-label={placement === "mobile" ? open ? "Close navigation" : "Open navigation" : label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); focusFirst.current = true; if (open) { root.current?.querySelector<HTMLElement>(".workspace-disclosure-panel a")?.focus(); focusFirst.current = false; } else setOpen(true); } }}>
      {placement === "mobile" ? open ? <X size={20}/> : <Menu size={20}/> : <>{icon}<span>{label}</span><ChevronDown size={12}/></>}
    </button>
    <div id={id} className="workspace-disclosure-panel" hidden={!open} onClick={event => { if ((event.target as Element).closest("a")) setOpen(false); }}>{children}</div>
  </div>;
}

export function WorkspaceSkipLink() {
  return <a className="workspace-skip" href="#workspace-main" onClick={event => { const main = document.querySelector("main"); if (main) { event.preventDefault(); main.tabIndex = -1; main.focus({ preventScroll: true }); main.scrollIntoView({ block: "start" }); } }}>Skip to page content</a>;
}
