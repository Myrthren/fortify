"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronRight, CircleDot, Compass, Layers3, Pencil, Plus, RotateCcw, Trash2, Users2, Workflow } from "lucide-react";
import { BUSINESS_CHANNELS, BUSINESS_MODELS, BUSINESS_STAGES, buildBusinessRecommendations, type BusinessRecommendation, type BusinessSetupInput } from "@/lib/business-setup";
import { responseError } from "@/lib/response-error";

type Business = BusinessSetupInput & { id: string; active: boolean; recommendations: BusinessRecommendation[]; createdAt: string | Date; updatedAt: string | Date };
const blank: BusinessSetupInput = { name: "", website: "", industry: "", stage: "Early revenue", businessModel: "Services", offer: "", audience: "", objective: "", bottleneck: "", teamSize: "1", channels: [] };
const questions = [
  { title: "Name the operation", detail: "The identity and stage Fortify should organise around." },
  { title: "Define the exchange", detail: "What you sell, who acts and how demand reaches you." },
  { title: "Set the direction", detail: "The outcome and constraint that should shape the first plan." },
  { title: "Activate the blueprint", detail: "Review what Fortify will configure before it becomes live context." },
];

export function BusinessSetup({ tier, limit, initialBusinesses, startNew = false }: { tier: string; limit: number | null; initialBusinesses: Business[]; startNew?: boolean }) {
  const router = useRouter();
  const [businesses, setBusinesses] = useState(initialBusinesses), [creating, setCreating] = useState(initialBusinesses.length === 0 || (startNew && (limit === null || initialBusinesses.length < limit))), [editingId, setEditingId] = useState<string | null>(null), [step, setStep] = useState(0), [form, setForm] = useState<BusinessSetupInput>(blank), [busy, setBusy] = useState(false), [error, setError] = useState("");
  function syncBusinesses(clearNew = false) {
    window.dispatchEvent(new CustomEvent("fortify:businesses-changed"));
    if (clearNew && new URLSearchParams(window.location.search).get("new") === "1") router.replace("/dashboard/setup", { scroll: false });
    else router.refresh();
  }
  const active = businesses.find(item => item.active) ?? businesses[0], atLimit = limit !== null && businesses.length >= limit, overCapacity = limit !== null && businesses.length > limit;
  const recommendations = useMemo(() => {
    try { return buildBusinessRecommendations({ ...form, name: form.name || "This business", audience: form.audience || "the intended audience", offer: form.offer || "the offer", bottleneck: form.bottleneck || "the current constraint", channels: form.channels.length ? form.channels : ["Content"] }); }
    catch { return []; }
  }, [form]);
  function update<K extends keyof BusinessSetupInput>(key: K, value: BusinessSetupInput[K]) { setForm(current => ({ ...current, [key]: value })); setError(""); }
  function toggleChannel(channel: string) { update("channels", form.channels.includes(channel) ? form.channels.filter(item => item !== channel) : [...form.channels, channel]); }
  function next() {
    const valid = step === 0 ? form.name && form.industry && form.stage && form.businessModel : step === 1 ? form.offer && form.audience && form.channels.length : step === 2 ? form.objective && form.bottleneck && form.teamSize : true;
    if (!valid) { setError("Complete the questions on this step to continue."); return; }
    setStep(value => Math.min(3, value + 1)); setError("");
  }
  function start() { setForm(blank); setEditingId(null); setStep(0); setError(""); setCreating(true); }
  function edit(business: Business) { const { id, active: _active, recommendations: _recommendations, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = business; setForm(input); setEditingId(id); setStep(0); setError(""); setCreating(true); }
  function cancel() { if (!businesses.length) return; setForm(blank); setEditingId(null); setStep(0); setError(""); setCreating(false); }
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/businesses", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? { ...form, id: editingId } : form) });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json();
      setBusinesses(current => editingId ? current.map(item => item.id === editingId ? data.business : item) : [data.business, ...current.map(item => ({ ...item, active: false }))]); setCreating(false); setEditingId(null); setStep(0); setForm(blank);
      syncBusinesses(!editingId);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function activate(id: string) {
    if (active?.id === id || busy) return; setBusy(true); setError("");
    try { const response = await fetch("/api/businesses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); if (!response.ok) throw new Error(await responseError(response)); setBusinesses(current => current.map(item => ({ ...item, active: item.id === id }))); syncBusinesses(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this business and its setup blueprint? Other saved Fortify work will remain.")) return;
    setBusy(true); setError("");
    try { const response = await fetch("/api/businesses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); if (!response.ok) throw new Error(await responseError(response)); setBusinesses(current => { const remaining = current.filter(item => item.id !== id); return remaining.map((item, index) => ({ ...item, active: item.active || (!remaining.some(row => row.active) && index === 0) })); }); syncBusinesses(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  if (tier === "FREE") return <div className="business-gate"><div><Building2 size={28}/><h1>Build Fortify around your business.</h1><p>The guided setup creates persistent business context, a recommended operating path and the starting conditions for agent work.</p><Link href="/pricing" className="btn-primary">Unlock business setup <ArrowRight size={15}/></Link><Link href="/dashboard">Return to dashboard</Link></div><BlueprintPreview name="Your business" recommendations={buildBusinessRecommendations({ ...blank, name: "Your business", offer: "your offer", audience: "your audience", objective: "your primary outcome", bottleneck: "your current constraint", channels: ["Content"] })}/></div>;
  return <>
    <header className="business-setup-header"><div><h1>{creating ? editingId ? "Update the context Fortify works from." : "Build the operating system around your business." : "Your business context is live."}</h1><p>{creating ? editingId ? "Revise the source context and Fortify will rebuild its recommended operating path." : "Answer three short sections. Fortify will configure a practical starting path without locking you into a tutorial." : "Switch the active business to change the context future plans and agents should work from."}</p></div><div className="business-capacity"><span>{limit === null ? "Unlimited" : `${businesses.length} / ${limit}`}</span><small>{tier.charAt(0) + tier.slice(1).toLowerCase()} business capacity</small></div></header>
    {!creating && active ? <div className="business-live-layout"><aside className="business-roster"><div><h2>Businesses</h2><button disabled={atLimit || busy} onClick={start}><Plus size={14}/> Add</button></div><p>{overCapacity ? `This account is above its ${tier.charAt(0)+tier.slice(1).toLowerCase()} limit. Remove saved businesses before switching context.` : atLimit ? `${tier.charAt(0)+tier.slice(1).toLowerCase()} capacity reached.` : "Choose the context Fortify should use."}</p><ol>{businesses.map(item => <li key={item.id}><button onClick={() => void activate(item.id)} aria-pressed={item.active} disabled={busy || (overCapacity && !item.active)}><span>{item.active ? <CircleDot size={14}/> : <Building2 size={14}/>}</span><strong>{item.name}<small>{item.businessModel} · {item.stage}</small></strong><ChevronRight size={14}/></button><button className="business-remove" onClick={() => void remove(item.id)} aria-label={`Remove ${item.name}`} disabled={busy}><Trash2 size={13}/></button></li>)}</ol></aside><section className="business-live"><div className="business-live-title"><div><span>Active context</span><h2>{active.name}</h2><p>{active.offer}</p></div><div className="business-live-actions"><span>{active.industry}</span><button onClick={()=>edit(active)} disabled={busy}><Pencil size={13}/> Edit context</button></div></div><dl><div><dt>Audience</dt><dd>{active.audience}</dd></div><div><dt>Primary outcome</dt><dd>{active.objective}</dd></div><div><dt>Constraint</dt><dd>{active.bottleneck}</dd></div><div><dt>Demand channels</dt><dd>{active.channels.join(" · ")}</dd></div></dl><BlueprintPreview name={active.name} recommendations={active.recommendations}/></section></div> : <div className="business-builder">
      <aside className="business-steps"><div className="business-progress" aria-hidden><span style={{ width: `${(step + 1) * 25}%` }}/></div><ol>{questions.map((item,index)=><li key={item.title} className={index === step ? "is-current" : index < step ? "is-done" : ""}><button onClick={()=>index<step&&setStep(index)} disabled={index>step}><span>{index < step ? <Check size={13}/> : String(index+1).padStart(2,"0")}</span><strong>{item.title}</strong><p>{item.detail}</p></button></li>)}</ol>{editingId?<button className="business-cancel" onClick={cancel}>Cancel changes</button>:<Link href="/dashboard">Skip setup for now</Link>}</aside>
      <section className="business-question"><div className="business-question-heading"><span>{step + 1} of 4</span><h2>{questions[step].title}</h2><p>{questions[step].detail}</p></div>{step===0&&<div className="business-fields"><Field label="Business name" value={form.name} onChange={value=>update("name",value)} placeholder="e.g. Northstar Studio"/><Field label="Website (optional)" value={form.website} onChange={value=>update("website",value)} placeholder="https://" type="url"/><Field label="Industry" value={form.industry} onChange={value=>update("industry",value)} placeholder="e.g. Product design"/><SelectField label="Stage" value={form.stage} onChange={value=>update("stage",value)} options={BUSINESS_STAGES}/><SelectField label="Business model" value={form.businessModel} onChange={value=>update("businessModel",value)} options={BUSINESS_MODELS}/></div>}{step===1&&<div className="business-fields"><Field label="What do you sell?" value={form.offer} onChange={value=>update("offer",value)} placeholder="Describe the offer and its value" area/><Field label="Who needs it most?" value={form.audience} onChange={value=>update("audience",value)} placeholder="Describe the customer and their situation" area/><fieldset className="business-channel-field"><legend>How do customers currently find you?</legend><div>{BUSINESS_CHANNELS.map(channel=><button type="button" key={channel} aria-pressed={form.channels.includes(channel)} onClick={()=>toggleChannel(channel)}>{form.channels.includes(channel)&&<Check size={12}/>} {channel}</button>)}</div></fieldset></div>}{step===2&&<div className="business-fields"><Field label="Most important outcome for the next 90 days" value={form.objective} onChange={value=>update("objective",value)} placeholder="Name one measurable business outcome" area/><Field label="What is most likely to prevent it?" value={form.bottleneck} onChange={value=>update("bottleneck",value)} placeholder="The constraint, uncertainty or repeated problem" area/><Field label="People working in the business" value={form.teamSize} onChange={value=>update("teamSize",value)} placeholder="1" type="number"/></div>}{step===3&&<div className="business-review"><div><CheckCircle2 size={23}/><h3>{form.name}</h3><p>{form.offer}</p></div><dl><div><dt>Direction</dt><dd>{form.objective}</dd></div><div><dt>Constraint</dt><dd>{form.bottleneck}</dd></div><div><dt>Channels</dt><dd>{form.channels.join(" · ")}</dd></div></dl><p>Activating this blueprint saves the business as your current Fortify context. You can switch businesses later.</p></div>}{error&&<p className="business-error" role="alert">{error}</p>}<div className="business-question-actions">{step>0&&<button className="btn-secondary" onClick={()=>setStep(value=>value-1)} disabled={busy}><ArrowLeft size={14}/> Back</button>}<button className="btn-primary" onClick={step===3?()=>void save():next} disabled={busy}>{busy?"Activating…":step===3?"Activate business":"Continue"}<ArrowRight size={14}/></button></div></section>
      <BlueprintPreview name={form.name || "Your business"} recommendations={recommendations}/>
    </div>}
    {error&&!creating&&<p className="business-error business-page-error" role="alert">{error}</p>}
  </>;
}

function BlueprintPreview({ name, recommendations }: { name: string; recommendations: BusinessRecommendation[] }) { const icons=[Compass,Users2,Workflow]; return <aside className="business-blueprint" aria-label={`${name} operating blueprint`}><header><span><Layers3 size={15}/> Live blueprint</span><strong>{name}</strong><small>{recommendations.length ? "A starting path generated from this business context" : "Complete the interview to reveal the starting path"}</small></header><div className="business-blueprint-line" aria-hidden/><ol>{recommendations.map((item,index)=>{const Icon=icons[index]??RotateCcw;return <li key={item.phase}><span><Icon size={15}/></span><div><small>{item.phase}</small><strong>{item.title}</strong><p>{item.detail}</p><Link href={item.href}>{item.tool}<ChevronRight size={12}/></Link></div></li>})}</ol></aside>; }
function Field({label,value,onChange,placeholder,type="text",area=false}:{label:string;value:string;onChange:(value:string)=>void;placeholder:string;type?:string;area?:boolean}) { return <label className={area?"business-field is-wide":"business-field"}><span>{label}</span>{area?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={4}/>:<input type={type} min={type==="number"?1:undefined} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}</label>; }
function SelectField({label,value,onChange,options}:{label:string;value:string;onChange:(value:string)=>void;options:readonly string[]}) { return <label className="business-field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(option=><option key={option}>{option}</option>)}</select></label>; }
