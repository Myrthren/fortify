"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Globe2, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

type Finding = { area: "website" | "search" | "domain" | "local"; status: "ready" | "review" | "missing"; title: string; detail: string };
type Pulse = { id: string; url: string; score: number; summary: string; findings: Finding[]; checkedAt: string };

const areaLabel = { website: "Website", search: "Search readiness", domain: "Domain trust", local: "Local presence" };

export function SitePulseClient({ business, initial }: { business: { name: string; website: string | null } | null; initial: Pulse | null }) {
  const [pulse, setPulse] = useState<Pulse | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function scan() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/site-pulse", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Website Pulse could not finish this check.");
      setPulse(data.pulse);
    } catch (err) { setError(err instanceof Error ? err.message : "Website Pulse could not finish this check."); }
    finally { setLoading(false); }
  }
  return <div className="space-y-8">
    <header className="flex flex-col gap-5 border-b border-bg-border pb-7 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Website Pulse</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">A hands-off public check of your website, search-readiness, domain trust and local presence. It uses public evidence only—never private analytics, inboxes or rankings.</p></div><button onClick={() => void scan()} disabled={loading || !business?.website} className="btn-primary shrink-0">{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}{pulse ? "Run fresh check" : "Run Website Pulse"}</button></header>
    {!business?.website ? <section className="card p-7"><Globe2 className="h-6 w-6 text-text-muted"/><h2 className="mt-4 text-lg font-medium">Add your business website first</h2><p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">Website Pulse checks the public website attached to your active business. No connection or API key is required.</p><Link href="/dashboard/setup" className="btn-primary mt-5">Update business website</Link></section> : <><section className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,.55fr)]"><div className="card p-6"><div className="flex items-start gap-3"><Globe2 className="mt-0.5 h-5 w-5 text-text-muted"/><div><p className="text-sm font-medium">{business.name}</p><a className="mt-1 block break-all text-sm text-text-muted hover:text-text" href={business.website} target="_blank" rel="noreferrer">{business.website}</a></div></div>{pulse ? <p className="mt-6 max-w-2xl text-sm leading-7 text-text-muted">{pulse.summary}</p> : <p className="mt-6 max-w-2xl text-sm leading-7 text-text-muted">Run the first check to turn public site and domain evidence into concrete next actions.</p>}</div><div className="card p-6"><p className="text-xs font-medium uppercase tracking-wide text-text-muted">Public signal score</p><p className="mt-3 text-5xl font-semibold tracking-tight tabular-nums">{pulse ? pulse.score : "—"}<span className="text-lg font-normal text-text-dim">{pulse ? "/100" : ""}</span></p><p className="mt-3 text-xs leading-5 text-text-dim">This is a checklist score, not a ranking, deliverability, or revenue claim.</p>{pulse && <p className="mt-4 text-xs text-text-muted">Checked {new Date(pulse.checkedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>}</div></section>{error && <div className="flex gap-2 rounded-lg border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-300" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}{pulse ? <section className="grid gap-4 md:grid-cols-2">{(["website", "search", "domain", "local"] as const).map(area => { const findings = pulse.findings.filter(item => item.area === area); return <div className="card p-5" key={area}><h2 className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-text-muted"/>{areaLabel[area]}</h2><ul className="mt-4 space-y-4">{findings.map(item => <li className="flex gap-3" key={item.title}>{item.status === "ready" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400"/> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"/>}<div><strong className="text-sm font-medium">{item.title}</strong><p className="mt-1 text-xs leading-5 text-text-muted">{item.detail}</p></div></li>)}</ul></div>})}</section> : <section className="card flex min-h-56 flex-col items-center justify-center p-7 text-center"><Sparkles className="h-6 w-6 text-text-muted"/><h2 className="mt-4 text-lg font-medium">Ready when you are</h2><p className="mt-2 max-w-md text-sm leading-6 text-text-muted">The first scan checks public pages and DNS records only. It will not change your website, domain, or listings.</p></section>}</>}</div>;
}
