"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Lock, Search } from "lucide-react";
import { TOOLS, isLocked } from "@/lib/tools";
import { TIERS } from "@/lib/tiers";
import type { Tier } from "@prisma/client";

export function ToolSearch({ tier }: { tier: Tier }) {
  const [query, setQuery] = useState("");
  const container = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const items = Object.values(TOOLS).filter(item => !item.soon && `${item.label} ${item.desc}`.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (!container.current?.getClientRects().length) return;
      const target = event.target as HTMLElement;
      const editing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") || (event.key === "/" && !editing)) {
        event.preventDefault();
        if (container.current) { container.current.open = !container.current.open; if (container.current.open) input.current?.focus(); }
      }
      if (event.key === "Escape" && container.current?.open) {
        container.current.open = false;
        container.current.querySelector("summary")?.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (container.current && !container.current.contains(event.target as Node)) container.current.open = false;
    }
    function other(event: Event) { if ((event as CustomEvent).detail !== "tool-search" && container.current) container.current.open = false; }
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", outside); window.addEventListener("fortify:navigation-open", other);
    return () => { document.removeEventListener("keydown", keydown); document.removeEventListener("pointerdown", outside); window.removeEventListener("fortify:navigation-open", other); };
  }, []);

  return <details ref={container} className="workspace-search" onToggle={() => { if (container.current?.open) { window.dispatchEvent(new CustomEvent("fortify:navigation-open", { detail: "tool-search" })); input.current?.focus(); } }}>
    <summary aria-label="Search Fortify tools"><Search size={14}/><span>Find a workspace…</span><kbd>Ctrl K</kbd></summary>
    <div className="workspace-search-panel">
      <div className="workspace-search-input"><Search size={16}/><input ref={input} type="search" aria-label="Search Fortify tools" placeholder="Search leads, content, research…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); container.current?.querySelector<HTMLAnchorElement>("li a")?.focus(); } else if (event.key === "Enter") { event.preventDefault(); container.current?.querySelector<HTMLAnchorElement>("li a")?.click(); } }}/></div>
      <p className="workspace-search-caption">{items.length} tools <span>Search the Fortify toolkit</span></p>
      <ul onKeyDown={event => { if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return; const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>("a")], index = links.indexOf(document.activeElement as HTMLAnchorElement); if (index < 0) return; event.preventDefault(); if (event.key === "ArrowUp" && index === 0) input.current?.focus(); else links[Math.max(0, Math.min(links.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus(); }}>{items.map(item => {
        const locked = isLocked(item.minTier, tier);
        return <li key={item.key}><Link href={locked ? "/pricing" : item.href} data-tool-result onClick={() => { if (container.current) container.current.open = false; }}>
          <item.icon size={17}/><span><strong>{item.label}</strong><small>{item.desc}</small></span>{locked ? <span className="workspace-search-tier"><Lock size={10}/>{TIERS[item.minTier!].name}</span> : <ArrowUpRight size={13}/>}</Link></li>;
      })}</ul>
      {!items.length && <div className="workspace-search-empty">No tools match that search. Try “leads” or “content”.</div>}
    </div>
  </details>;
}
