"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Compass, FileText, Radar } from "lucide-react";
import { WORKSPACE_GOALS, goalSteps, type WorkspaceGoal, type GoalSignals } from "@/lib/workspace-goals";
import { responseError } from "@/lib/response-error";

export function GoalOnboarding({ initialGoal, initialDismissed, signals, tier }: { initialGoal: WorkspaceGoal | null; initialDismissed: boolean; signals: GoalSignals; tier: string }) {
  const [goal, setGoal] = useState(initialGoal), [dismissed, setDismissed] = useState(initialDismissed);
  const [choosing, setChoosing] = useState(!initialGoal), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const icons = [Compass, FileText, Radar];
  async function save(nextGoal?: WorkspaceGoal, hide = false) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/workspace/goal", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(nextGoal ? { goal: nextGoal } : {}), dismissed: hide }) });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json(); setGoal(data.preference.goal); setDismissed(data.preference.dismissed); setChoosing(!data.preference.goal);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const steps = goal ? goalSteps(goal, signals, tier) : [];
  const complete = steps.length > 0 && steps.every(step => step.done);
  if (dismissed) return <div id="workspace-goal" className="workspace-setup-collapsed"><span>Your workspace, at your pace.</span><button onClick={() => save(goal ?? undefined)} disabled={busy}>Choose your focus <ArrowRight size={13}/></button>{error && <span role="alert">{error}</span>}</div>;
  return <section id="workspace-goal" className="workspace-goal card-elevated" aria-label="Your workspace focus">
    <div className="workspace-section-heading"><div><span className="eyebrow">YOUR NEXT STEP</span><h2>{choosing ? "What would you like Fortify to help with?" : complete ? "Your first steps are complete." : WORKSPACE_GOALS.find(item => item.value === goal)?.label}</h2><p>{choosing ? "Choose one focus. You can change it or explore freely." : complete ? "Keep building on your results. Your toolkit is always available below." : "A short path to a useful result, using your own business."}</p></div><div className="workspace-heading-actions">{goal && <button disabled={busy} onClick={() => setChoosing(!choosing)}>{choosing ? "Back" : "Change focus"}</button>}<button disabled={busy} onClick={() => save(undefined, true)}>{complete ? "Dismiss" : "Skip for now"}</button></div></div>
    {choosing ? <div className="workspace-goal-options">{WORKSPACE_GOALS.map((item, index) => { const Icon = icons[index]; return <button key={item.value} disabled={busy} onClick={() => save(item.value)} aria-pressed={goal === item.value}><Icon size={20}/><strong>{item.label}</strong><span>{item.description}</span><span className="workspace-goal-cta">{busy ? "Saving…" : "Start here"} <ArrowRight size={14}/></span></button>; })}</div>
      : <><div className="workspace-goal-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={steps.filter(item => item.done).length}><span style={{ width: `${steps.filter(item => item.done).length / steps.length * 100}%` }}/></div><div className="workspace-goal-steps">{steps.map((step, index) => <Link href={step.href} key={step.title} aria-label={`${step.title}${step.done ? ", complete" : ""}`}><span className={step.done ? "workspace-step-done" : ""}>{step.done ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</span><div><small>0{index + 1}</small><strong>{step.title}</strong><p>{step.description}</p></div>{!step.done && <ArrowRight size={15}/>}</Link>)}</div><p className="workspace-context-tip">For more specific results, <Link href={tier === "FREE" ? "/dashboard/profile" : "/dashboard/company-dna"}>add some context about your business</Link> whenever you’re ready.</p></>}
    {error && <p className="workspace-error" role="alert">{error}</p>}
  </section>;
}
