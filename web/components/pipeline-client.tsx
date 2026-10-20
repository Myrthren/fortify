"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, ExternalLink, Loader2, Plus, Search, X } from "lucide-react";
import { PIPELINE_STAGES, CLOSED_STAGES, dueToday, stageLabel, type PipelineLead } from "@/lib/pipeline";
import { responseError } from "@/lib/response-error";

export function PipelineClient({ initialLeads, selectedId, initialView = "all", nextCursor, initialCounts }: { initialLeads: PipelineLead[]; selectedId?: string; initialView?: string; nextCursor?: string | null; initialCounts?: Record<string, number> }) {
  const [leads, setLeads] = useState(initialLeads), [current, setCurrent] = useState<PipelineLead | null>(initialLeads.find(item => item.id === selectedId) ?? null);
  const [counts, setCounts] = useState(initialCounts ?? Object.fromEntries(PIPELINE_STAGES.map(item => [item.value, initialLeads.filter(lead => lead.status === item.value).length])));
  const [dirty, setDirty] = useState(false), [filtering, setFiltering] = useState(false), [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");
  const firstFilter = useRef(true);
  const listEpoch = useRef(0);
  const [query, setQuery] = useState(""), [stage, setStage] = useState("all"), [view, setView] = useState(initialView);
  const [adding, setAdding] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [company, setCompany] = useState(""), [url, setUrl] = useState(""), [context, setContext] = useState("");
  const [cursor, setCursor] = useState(nextCursor), [loadingMore, setLoadingMore] = useState(false);
  const filtered = leads.filter(lead => (stage === "all" || lead.status === stage) && (view !== "due" || dueToday(lead.followUpAt, lead.status)) && (view !== "open" || !CLOSED_STAGES.includes(lead.status)) && `${lead.company ?? ""} ${lead.url} ${lead.context ?? ""} ${lead.notes} ${lead.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    listEpoch.current++;
    if (firstFilter.current) { firstFilter.current = false; return; }
    const controller = new AbortController(); setFiltering(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, stage, view });
        const response = await fetch('/api/pipeline?' + params, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(await responseError(response));
        const data = await response.json(); setLeads(data.leads); setCursor(data.nextCursor); setCounts(data.counts); setError('');
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { if (!controller.signal.aborted) setFiltering(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, stage, view, reload]);
  function select(lead: PipelineLead | null) { if (current?.id === lead?.id) return; if (dirty && !window.confirm('Discard your unsaved prospect changes?')) return; setDirty(false); setCurrent(lead); }
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company, url, context, source: "manual" }) });
      if (!response.ok) throw new Error(await responseError(response));
      const { lead } = await response.json(); setLeads(previous => [lead, ...previous.filter(item => item.id !== lead.id)]); setCurrent(lead); setDirty(false); setReload(value => value + 1); setAdding(false); setCompany(""); setUrl(""); setContext("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function loadMore() {
    const epoch = listEpoch.current;
    setLoadingMore(true); setError("");
    try { const response = await fetch('/api/pipeline?' + new URLSearchParams({ cursor: cursor!, q: query, stage, view }), { cache: "no-store" }); if (!response.ok) throw new Error(await responseError(response)); const data = await response.json(); if (epoch !== listEpoch.current) return; setLeads(previous => [...previous, ...data.leads.filter((item: PipelineLead) => !previous.some(existing => existing.id === item.id))]); setCursor(data.nextCursor); setCounts(data.counts); } catch (e) { if (epoch === listEpoch.current) setError((e as Error).message); } finally { setLoadingMore(false); }
  }
  return <div className="pipeline-workspace">
    <div className="pipeline-intro"><div><span className="eyebrow">FROM PROSPECT TO CONVERSATION</span><h1>Your lead pipeline</h1><p>Keep research, drafts and follow-ups together. Update stages as conversations move forward.</p></div><button className="btn-primary" onClick={() => { if (dirty && !window.confirm("Discard your unsaved prospect changes?")) return; setCurrent(null); setDirty(false); setAdding(!adding); }}><Plus size={15}/> Add a prospect</button></div>
    {adding && <form className="pipeline-add card" onSubmit={add}><div className="workspace-section-heading"><h2>Add a prospect</h2><button type="button" aria-label="Close add prospect" onClick={() => setAdding(false)}><X size={16}/></button></div><label>Business or contact name<input className="input" value={company} onChange={e => setCompany(e.target.value)} maxLength={160} required/></label><label>Website or profile URL<input type="url" className="input" placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} maxLength={2048} required/></label><label className="pipeline-add-context">What do you know about them?<textarea className="input" value={context} onChange={e => setContext(e.target.value)} maxLength={6000} rows={3}/></label><button className="btn-primary" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin"/>} Save prospect</button></form>}
    <nav className="pipeline-stage-strip" aria-label="Filter pipeline by stage">{[{ value: "all", label: "All stages" }, ...PIPELINE_STAGES].map(item => <button key={item.value} aria-pressed={stage === item.value} onClick={() => setStage(item.value)}><span>{item.label}</span><strong>{item.value === "all" ? Object.values(counts).reduce((sum, count) => sum + count, 0) : counts[item.value] ?? 0}</strong></button>)}</nav>
    <div className="pipeline-filters"><label><Search size={16}/><input type="search" placeholder="Search prospects, notes or research…" aria-label="Search your pipeline" value={query} maxLength={160} onChange={e => setQuery(e.target.value)}/></label><select aria-label="Show pipeline leads" value={view} onChange={e => setView(e.target.value)}><option value="all">All prospects</option><option value="open">Open prospects</option><option value="due">Follow-ups due</option></select></div>
    {notice && <p role="status" className="text-sm text-text-muted mb-3">{notice}</p>}
    {error && <p role="alert" className="workspace-error">{error}</p>}
    <div className={`pipeline-layout ${current ? "has-selection" : ""}`}><section className="pipeline-list" aria-label="Saved prospects">
      {filtered.length ? filtered.map(lead => <button key={lead.id} onClick={() => select(lead)} aria-pressed={current?.id === lead.id} className="pipeline-lead-card"><div className="pipeline-card-top"><span>{lead.source.replaceAll("-", " ")}</span><span className={`pipeline-stage stage-${lead.status}`}>{stageLabel(lead.status)}</span></div><h2>{lead.company || lead.url.replace(/^https?:\/\//, "")}</h2><p>{lead.context || "Add research or notes to prepare a more specific first message."}</p><div className="pipeline-card-bottom"><span>{lead.draft ? "Draft saved" : "No draft yet"}</span>{lead.followUpAt && <time className={dueToday(lead.followUpAt, lead.status) ? "pipeline-due" : ""} dateTime={lead.followUpAt}>Follow up {lead.followUpAt.slice(0, 10)}</time>}<ArrowRight size={14}/></div></button>) : <div className="workspace-empty card"><h2>{leads.length ? "No prospects match these filters." : "Give your next conversation a home."}</h2><p>{leads.length ? "Try another stage or clear your search." : "Add a prospect above, or save a result from Recon, Lead Sourcing, Lead Extractor or a Weekly Lead Pack."}</p><Link href="/dashboard/leads">Find prospects <ArrowRight size={14}/></Link></div>}
      {cursor && <button className="btn-secondary" onClick={loadMore} disabled={loadingMore || filtering}>{loadingMore ? "Loading…" : "Load more prospects"}</button>}
      <p className="pipeline-list-note">{filtering ? "Searching your pipeline…" : <>Showing {filtered.length} matching prospects{cursor ? " · More results available" : ""}.</>}</p>
    </section>{current && <LeadDetail key={`${current.id}:${current.updatedAt}`} lead={current} onClose={() => select(null)} onDirty={setDirty} onSave={saved => { setLeads(previous => previous.map(item => item.id === saved.id ? saved : item)); setCurrent(saved); setDirty(false); setNotice("Prospect changes saved."); setReload(value => value + 1); }}/>}</div>
  </div>;
}

function LeadDetail({ lead, onClose, onSave, onDirty }: { lead: PipelineLead; onClose: () => void; onSave: (lead: PipelineLead) => void; onDirty: (value: boolean) => void }) {
  const [status, setStatus] = useState(lead.status), [notes, setNotes] = useState(lead.notes), [followUpAt, setFollowUpAt] = useState(lead.followUpAt?.slice(0, 10) ?? "");
  const [company, setCompany] = useState(lead.company ?? ""), [email, setEmail] = useState(lead.email ?? ""), [draft, setDraft] = useState(lead.draft ?? "");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [copied, setCopied] = useState(false), [message, setMessage] = useState("");
  const dirty = status !== lead.status || notes !== lead.notes || followUpAt !== (lead.followUpAt?.slice(0, 10) ?? "") || company !== (lead.company ?? "") || email !== (lead.email ?? "") || draft !== (lead.draft ?? "");
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/pipeline/${encodeURIComponent(lead.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: company || new URL(lead.url).hostname, status, notes, followUpAt: followUpAt || null, email, draft, updatedAt: lead.updatedAt }) });
      if (!response.ok) throw new Error(await responseError(response));
      setMessage("Changes saved."); onSave((await response.json()).lead);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <aside className="pipeline-detail card" aria-label="Prospect details"><div className="workspace-section-heading"><span className="eyebrow">PROSPECT DETAILS</span><button onClick={onClose} aria-label="Close prospect details"><X size={17}/></button></div><form onSubmit={save}>
    <label>Business or contact name<input className="input" value={company} onChange={e => setCompany(e.target.value)} maxLength={160}/></label><a href={lead.url} target="_blank" rel="noopener noreferrer" className="pipeline-source-link">Open source <ExternalLink size={12}/></a>
    <div className="pipeline-detail-fields"><label>Stage<select className="input" value={status} onChange={e => setStatus(e.target.value)}>{PIPELINE_STAGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Follow-up date<input type="date" className="input" value={followUpAt} onChange={e => setFollowUpAt(e.target.value)}/></label></div>
    <label>Contact email<input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} maxLength={254}/></label>
    {lead.context && <div className="pipeline-research"><h3>Saved research</h3><p>{lead.context}</p></div>}
    <label>Notes<textarea className="input" rows={4} value={notes} onChange={e => setNotes(e.target.value)} maxLength={6000} placeholder="What matters to them? What is the next step?"/></label>
    <div className="pipeline-draft-heading"><h3>Outreach draft</h3><Link href={`/dashboard/outreach?lead=${encodeURIComponent(lead.id)}`} onClick={event => { if (dirty) { event.preventDefault(); setError("Save your changes before opening the outreach generator."); } }}>Write with AI <ArrowRight size={13}/></Link></div>
    <textarea aria-label="Outreach draft" className="input" rows={7} value={draft} onChange={e => setDraft(e.target.value)} maxLength={16000} placeholder="Draft a message here, or use Write with AI to bring in the saved research."/>
    <p className="pipeline-disclosure">Drafting or copying a message does not send it. Mark a lead Contacted after you reach out.</p>
    <div className="pipeline-detail-actions"><button className="btn-primary" disabled={busy || !dirty}>{busy && <Loader2 size={13} className="animate-spin"/>} Save changes</button><button type="button" className="btn-secondary" disabled={!draft} onClick={async () => { try { await navigator.clipboard.writeText(draft); setCopied(true); } catch { setError("Copy was unavailable. Select the draft text to copy it."); } }}>{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? "Copied" : "Copy draft"}</button></div>
    {error && <p className="workspace-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </form></aside>;
}
