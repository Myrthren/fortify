"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, ClipboardCheck, ExternalLink, Loader2, Plus, RotateCcw, Target, X } from "lucide-react";
import { MISSION_GOALS, missionGoalLabel, missionNextStep, missionProgress } from "@/lib/growth-mission";
import { stageLabel } from "@/lib/pipeline";
import { responseError } from "@/lib/response-error";
import type { Tier } from "@prisma/client";

type Business = { id: string; name: string; offer: string; audience: string; active: boolean };
type MissionSummary = { id: string; businessName: string; goal: string; target: number; status: string };
export type MissionProspect = { id: string; company: string | null; url: string; status: string; source: string; context: string | null; draft: string | null; email: string | null; updatedAt: string };
export type MissionView = {
  id: string; businessId: string; businessName: string; goal: string; target: number; deadline: string;
  offer: string; audience: string; status: string; createdAt: string; updatedAt: string;
  leads: { id: string; decision: string; reviewedAt: string | null; repliedAt: string | null; bookedAt: string | null; wonAt: string | null; lead: MissionProspect }[];
};

const dateLabel = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const nextMonth = () => { const date = new Date(); date.setDate(date.getDate() + 30); return date.toISOString().slice(0, 10); };
const leadName = (lead: MissionProspect) => { if (lead.company) return lead.company; try { return new URL(lead.url).hostname; } catch { return "Saved prospect"; } };

export function GrowthMissionClient({ tier, businesses, missions, mission, prospects }: { tier: Tier; businesses: Business[]; missions: MissionSummary[]; mission: MissionView | null; prospects: MissionProspect[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(missions.length === 0);
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [goal, setGoal] = useState("booked-calls"), [target, setTarget] = useState("10"), [deadline, setDeadline] = useState(nextMonth);
  const [offer, setOffer] = useState(businesses[0]?.offer ?? ""), [audience, setAudience] = useState(businesses[0]?.audience ?? "");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MissionProspect[] | null>(null), [searching, setSearching] = useState(false), [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const linked = new Set(mission?.leads.map(item => item.lead.id));
  const available = useMemo(() => (search.trim().length >= 2 ? (searchResults ?? []) : prospects).filter(item => !linked.has(item.id) && `${item.company ?? ""} ${item.url} ${item.context ?? ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 12), [prospects, searchResults, mission, search]);
  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults(null); setSearching(false); setSearchError(""); return; }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      setSearchError("");
      try {
        const response = await fetch(`/api/pipeline?q=${encodeURIComponent(search.trim())}&view=all`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(await responseError(response));
        const data = await response.json();
        setSearchResults(data.leads);
      } catch (caught) { if (!controller.signal.aborted) setSearchError((caught as Error).message); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 260);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);

  async function mutate(key: string, url: string, method: string, body: Record<string, unknown>, onSuccess?: (data: any) => boolean | void) {
    setBusy(key); setError(""); setNotice("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json();
      const navigated = onSuccess?.(data);
      if (!navigated) router.refresh();
    } catch (caught) { setError((caught as Error).message); }
    finally { setBusy(""); }
  }

  const start = (event: React.FormEvent) => {
    event.preventDefault();
    void mutate("create", "/api/missions", "POST", { businessId, goal, target: Number(target), deadline, offer, audience }, data => { router.push(`/dashboard/missions?mission=${encodeURIComponent(data.mission.id)}`); setCreating(false); setNotice("Mission created. Add prospects from your pipeline to review."); return true; });
  };
  const goalLabel = missionGoalLabel(mission?.goal ?? goal);
  const pending = mission?.leads.filter(item => item.decision === "pending") ?? [];
  const approved = mission?.leads.filter(item => item.decision === "approved") ?? [];
  const rejected = mission?.leads.filter(item => item.decision === "rejected") ?? [];
  const statuses = approved.map(item => item.lead.status);
  const progress = mission ? missionProgress(mission.goal, approved.map(item => ({ status: item.lead.status, repliedAt: item.repliedAt, bookedAt: item.bookedAt, wonAt: item.wonAt }))) : 0;
  const lastWeek = Date.now() - 7 * 86400000;
  const reviewedThisWeek = mission?.leads.filter(item => item.reviewedAt && new Date(item.reviewedAt).getTime() >= lastWeek && item.decision === "approved").length ?? 0;
  const touchedThisWeek = approved.filter(item => new Date(item.lead.updatedAt).getTime() >= lastWeek).length;
  const replies = approved.filter(item => item.repliedAt || item.lead.status === "replied").length;

  return <>
    <div className="mission-topline"><div><h1>Growth Missions</h1><p>One goal. A reviewed list. A visible path from work to outcome.</p></div>{businesses.length > 0 && <button type="button" className="btn-secondary" onClick={() => { setCreating(true); setError(""); }}><Plus size={16}/> New mission</button>}</div>
    {missions.length > 0 && <nav className="mission-switcher" aria-label="Choose a mission">{missions.map(item => <button type="button" key={item.id} aria-current={!creating && mission?.id === item.id ? "page" : undefined} onClick={() => { router.push(`/dashboard/missions?mission=${encodeURIComponent(item.id)}`); setCreating(false); setError(""); }}><span>{item.businessName}</span><strong>{item.target} {missionGoalLabel(item.goal).toLowerCase()}</strong><small>{item.status}</small></button>)}</nav>}
    {error && <p className="mission-error" role="alert">{error}</p>}{notice && <p className="mission-notice" role="status">{notice}</p>}
    {creating ? businesses.length ? <section className="mission-create"><div className="mission-intro"><Target size={28}/><h2>Give the work a destination.</h2><p>Choose an outcome you can record in the lead pipeline. Fortify will keep the goal, reviewed prospects and progress together.</p><p>Creating a mission does not search for leads, send outreach or use credits.</p></div><form onSubmit={start} className="mission-form">
      <label>Business<select className="input" value={businessId} onChange={event => { const next = businesses.find(item => item.id === event.target.value); setBusinessId(event.target.value); if (next) { setOffer(next.offer); setAudience(next.audience); } }}>{businesses.map(item => <option key={item.id} value={item.id}>{item.name}{item.active ? " · active" : ""}</option>)}</select></label>
      <div className="mission-form-grid"><label>Outcome<select className="input" value={goal} onChange={event => setGoal(event.target.value)}>{MISSION_GOALS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Target<input className="input" type="number" min="1" max="1000" required value={target} onChange={event => setTarget(event.target.value)}/></label><label>Deadline<input className="input" type="date" required min={new Date().toISOString().slice(0, 10)} value={deadline} onChange={event => setDeadline(event.target.value)}/></label></div>
      <label>Offer<textarea className="input" value={offer} onChange={event => setOffer(event.target.value)} maxLength={700} rows={3} required/></label>
      <label>Who you want to reach<textarea className="input" value={audience} onChange={event => setAudience(event.target.value)} maxLength={700} rows={3} required/></label>
      <div className="mission-form-actions"><button className="btn-primary" disabled={!!busy}>{busy === "create" && <Loader2 size={15} className="animate-spin"/>} Create mission <ArrowRight size={15}/></button>{missions.length > 0 && <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>}</div>
    </form></section> : <section className="mission-empty"><h2>Set up a business first.</h2><p>A mission needs an offer and an audience. Business Setup saves those details once for Fortify’s tools.</p><Link href="/dashboard/setup" className="btn-primary">Set up a business <ArrowRight size={15}/></Link></section> : mission ? <>
      <section className="mission-hero"><div><span className="mission-business">{mission.businessName} · {mission.status}</span><h2>{mission.target} {goalLabel.toLowerCase()} by {dateLabel(mission.deadline)}</h2><p>For {mission.audience}. Offer: {mission.offer}</p></div><div className="mission-outcome"><strong>{progress}<span> / {mission.target}</span></strong><span>{goalLabel} recorded in your pipeline</span><div className="mission-progress-track" role="meter" aria-label="Mission progress" aria-valuenow={Math.min(progress, mission.target)} aria-valuemin={0} aria-valuemax={mission.target}><span style={{ width: `${Math.min(100, progress / mission.target * 100)}%` }}/></div></div></section>
      <div className="mission-layout"><div className="mission-main">
        <section className="mission-section"><div className="mission-section-head"><div><h2>Approval Centre</h2><p>Review source, saved research and draft before including a prospect. Approval sends nothing and costs no credits.</p></div><span>{pending.length} waiting</span></div>
          {pending.length ? <div className="mission-review-list">{pending.map(item => <article key={item.id} className="mission-review-row"><div className="mission-review-copy"><div className="mission-review-title"><h3>{leadName(item.lead)}</h3><span>{stageLabel(item.lead.status)}</span></div><div className="mission-review-links"><a href={item.lead.url} target="_blank" rel="noopener noreferrer">View source <ExternalLink size={12}/></a><Link href={`/dashboard/pipeline?lead=${encodeURIComponent(item.lead.id)}`}>Open full pipeline record <ArrowRight size={12}/></Link></div><details className="mission-review-details"><summary>Read saved research and draft</summary><h4>Saved research</h4><p>{item.lead.context?.trim() || "No research saved yet. Check the source before approving."}</p><h4>Outreach draft</h4><p>{item.lead.draft?.trim() || "No draft saved yet. You can prepare one after approval."}</p></details></div><div className="mission-review-actions"><button type="button" className="btn-primary" disabled={!!busy || mission.status !== "active"} onClick={() => void mutate(`approve-${item.lead.id}`, `/api/missions/${mission.id}/leads`, "PATCH", { leadId: item.lead.id, decision: "approved" }, () => setNotice(`${leadName(item.lead)} approved for this mission.`))}>{busy === `approve-${item.lead.id}` ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>} Approve</button><button type="button" className="btn-secondary" disabled={!!busy || mission.status !== "active"} onClick={() => void mutate(`reject-${item.lead.id}`, `/api/missions/${mission.id}/leads`, "PATCH", { leadId: item.lead.id, decision: "rejected" }, () => setNotice(`${leadName(item.lead)} removed from review.`))}><X size={14}/> Reject</button></div></article>)}</div> : <p className="mission-list-empty">No prospects are waiting for review. Add a lead from your pipeline below.</p>}
        </section>
        <section className="mission-section"><div className="mission-section-head"><div><h2>Bring in prospects</h2><p>Your pipeline is shared across businesses. Choose only leads that fit this mission.</p></div><Link href="/dashboard/pipeline">Open pipeline <ArrowRight size={14}/></Link></div><label className="mission-search">Find a saved prospect<input className="input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, website or research"/></label>
          {searching && <p className="mission-search-status" role="status">Searching your pipeline…</p>}{searchError && <p className="mission-error" role="alert">Search failed: {searchError}</p>}
          {available.length ? <div className="mission-pick-list">{available.map(item => <div key={item.id} className="mission-pick-row"><div><strong>{leadName(item)}</strong><span>{stageLabel(item.status)} · {item.source}</span></div><button type="button" className="btn-secondary" disabled={!!busy || mission.status !== "active"} onClick={() => void mutate(`add-${item.id}`, `/api/missions/${mission.id}/leads`, "POST", { leadId: item.id }, () => setNotice(`${leadName(item)} added to review.`))}><Plus size={14}/> Review</button></div>)}</div> : !searching && !searchError && <p className="mission-list-empty">{search ? "No matching prospects. Try a more specific name or website." : prospects.length ? "No recent prospects left to review. Search your full pipeline above." : "Your pipeline is empty. Find leads or add one manually, then return to this mission."}</p>}
          <div className="mission-source-links"><Link href="/dashboard/pipeline">Add a lead manually <ArrowRight size={13}/></Link><Link href="/dashboard/leads">Score leads <ArrowRight size={13}/></Link>{(tier === "ELITE" || tier === "APEX") && <Link href="/dashboard/lead-pack">Weekly lead pack <ArrowRight size={13}/></Link>}</div>
        </section>
      </div><aside className="mission-side">
        <section className="mission-path"><h2>Operating path</h2><ol><li><span>Find</span><div><strong>Source a focused list</strong><Link href={tier === "ELITE" || tier === "APEX" ? "/dashboard/recon" : "/dashboard/leads"}>{tier === "ELITE" || tier === "APEX" ? "Open Recon" : "Open lead scoring"} <ArrowRight size={12}/></Link></div></li><li><span>Review</span><div><strong>Approve the right prospects</strong><small>{pending.length ? `${pending.length} waiting for your decision` : "Add a prospect to review"}</small></div></li><li><span>Reach out</span><div><strong>Write in your voice</strong><Link href="/dashboard/outreach">Open outreach <ArrowRight size={12}/></Link></div></li><li><span>Learn</span><div><strong>Record real outcomes</strong><Link href="/dashboard/pipeline">Open pipeline <ArrowRight size={12}/></Link></div></li></ol></section>
        <section className="mission-brief"><div className="mission-section-head"><h2>Weekly briefing</h2><ClipboardCheck size={18}/></div><p className="mission-brief-window">Last 7 days · based on your saved pipeline</p><div className="mission-brief-stats"><div><strong>{reviewedThisWeek}</strong><span>Prospects approved this week</span></div><div><strong>{touchedThisWeek}</strong><span>Approved leads updated this week</span></div><div><strong>{replies}</strong><span>Replies recorded, total</span></div></div><h3>Next move</h3><p>{missionNextStep(pending.length, statuses)}</p><small>Stages are recorded by you; Fortify does not verify calls or revenue.</small></section>
        <section className="mission-roster"><h2>Approved prospects <span>{approved.length}</span></h2>{approved.length ? <ul>{approved.map(item => <li key={item.id}><div><strong>{leadName(item.lead)}</strong><span>{stageLabel(item.lead.status)}</span></div><div className="mission-roster-actions"><Link href={`/dashboard/pipeline?lead=${encodeURIComponent(item.lead.id)}`} aria-label={`Open ${leadName(item.lead)} in pipeline`}><ArrowRight size={16}/></Link><button type="button" disabled={!!busy || mission.status !== "active"} aria-label={`Remove ${leadName(item.lead)} from mission`} title="Remove from mission" onClick={() => void mutate(`remove-${item.lead.id}`, `/api/missions/${mission.id}/leads`, "PATCH", { leadId: item.lead.id, decision: "rejected" }, () => setNotice(`${leadName(item.lead)} removed from the mission.`))}><X size={15}/></button></div></li>)}</ul> : <p>Approved prospects will appear here with their current pipeline stage.</p>}{rejected.length > 0 && <div className="mission-rejected"><strong>Declined · {rejected.length}</strong>{rejected.map(item => <div key={item.id}><span>{leadName(item.lead)}</span><button type="button" disabled={!!busy || mission.status !== "active"} onClick={() => void mutate(`restore-${item.lead.id}`, `/api/missions/${mission.id}/leads`, "PATCH", { leadId: item.lead.id, decision: "pending" }, () => setNotice(`${leadName(item.lead)} returned to review.`))}>Review again</button></div>)}</div>}</section>
        <div className="mission-status-actions"><button type="button" className="btn-secondary" disabled={!!busy} onClick={() => void mutate("status", `/api/missions/${mission.id}`, "PATCH", { status: mission.status === "active" ? "completed" : "active" }, () => setNotice(mission.status === "active" ? "Mission marked complete." : "Mission reopened."))}>{mission.status === "active" ? <Check size={14}/> : <RotateCcw size={14}/>} {mission.status === "active" ? "Mark mission complete" : "Reopen mission"}</button>{mission.status !== "archived" && <button type="button" className="mission-archive" disabled={!!busy} onClick={() => void mutate("archive", `/api/missions/${mission.id}`, "PATCH", { status: "archived" }, () => setNotice("Mission archived."))}>Archive mission</button>}</div>
      </aside></div>
    </> : null}
  </>;
}
