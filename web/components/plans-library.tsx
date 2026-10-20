"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Archive, Layers, Loader2, Plus } from "lucide-react";
import type { PlanSummary } from "@/lib/future-plans";
import { responseError } from "@/lib/response-error";

export function PlansLibrary({ initial, archived = false }: { initial: PlanSummary[]; archived?: boolean }) {
  const router = useRouter(); const [plans, setPlans] = useState(initial), [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [title, setTitle] = useState(""), [template, setTemplate] = useState("blank");
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, template }) }); if (!response.ok) throw Error(await responseError(response)); router.push(`/dashboard/plans/${(await response.json()).plan.id}`); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  async function archive(plan: PlanSummary) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/plans/${plan.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: plan.version, archived: !archived }) }); if (!response.ok) throw Error(await responseError(response)); setPlans(previous => previous.filter(item => item.id !== plan.id)); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="plans-library"><header className="plans-library-heading"><div><span className="eyebrow">MAKE ROOM FOR WHAT COMES NEXT</span><h1>{archived ? "Archived plans" : "Your plans, connected."}</h1><p>Map goals, decisions and future steps. Bring the right software and procedures into the plan when you need them.</p></div><button className="btn-primary" onClick={() => setCreating(!creating)}><Plus size={15}/> New plan</button></header>
    <div className="plans-library-switch"><Link href="/dashboard/plans" aria-current={!archived ? "page" : undefined}>Active plans</Link><Link href="/dashboard/plans?archived=true" aria-current={archived ? "page" : undefined}>Archived</Link><span>Planning connections describe intent. Procedures run only when you launch them.</span></div>
    {creating && <form className="plans-create card" onSubmit={create}><label>Plan title<input className="input" value={title} maxLength={120} required onChange={e => setTitle(e.target.value)} placeholder="e.g. Launch the new service"/></label><label>Starting point<select className="input" value={template} onChange={e => setTemplate(e.target.value)}><option value="blank">Blank canvas</option><option value="launch">New offer launch</option><option value="growth">90-day growth plan</option></select></label><button className="btn-primary" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin"/> : <Plus size={15}/>} Create plan</button></form>}
    {error && <p role="alert" className="workspace-error">{error}</p>}
    {plans.length ? <div className="plans-library-grid">{plans.map(plan => <article className="plan-library-card" key={plan.id}><Link href={`/dashboard/plans/${plan.id}`}><div className="plan-library-art" aria-hidden="true"><i/><i/><i/><i/><span/><span/><span/></div><div className="plan-library-title"><Layers size={16}/><h2>{plan.title}</h2><ArrowUpRight size={15}/></div><p>{plan.description || "Goals, decisions and the steps that connect them."}</p><div className="plan-library-progress"><span style={{ width: `${plan.cardCount ? plan.doneCount / plan.cardCount * 100 : 0}%` }}/></div><footer><span>{plan.doneCount} of {plan.cardCount} steps complete</span><time dateTime={plan.updatedAt}>Updated {new Date(plan.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</time></footer></Link><button disabled={busy} onClick={() => archive(plan)} className="plan-archive"><Archive size={12}/>{archived ? "Restore plan" : "Archive plan"}</button></article>)}</div> : <section className="plans-library-empty card"><Layers size={32}/><h2>{archived ? "No archived plans." : "Start with the future you want to build."}</h2><p>{archived ? "Plans you archive stay available here to restore." : "Place a goal on the canvas, add the steps around it, and connect what depends on what."}</p>{!archived && <button className="btn-primary" onClick={() => setCreating(true)}>Create your first plan <Plus size={14}/></button>}</section>}
  </div>;
}
