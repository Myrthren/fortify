"use client";
import { useEffect, useRef } from "react";
import { ArrowRight, Check, GraduationCap, Loader2, X } from "lucide-react";
import { TUTORIAL_STEPS, type TutorialStep } from "@/lib/simulation-tutorial";

export function SimulationTutorial({ step, businessName, busy, saving, error, onAction, onSkip, onExit }: { step: TutorialStep; businessName: string; busy: boolean; saving: boolean; error: string; onAction: () => void; onSkip: () => void; onExit: () => void }) {
  const content = TUTORIAL_STEPS[step];
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    // Keep keyboard focus inside the guide when its action replaces the step.
    // Selecting a real scene control keeps focus on that control instead.
    if (document.activeElement === document.body || root.current?.contains(document.activeElement)) root.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, [step]);
  return <section ref={root} className="institute-tutorial" aria-label="Simulation walkthrough" aria-busy={saving}>
    <div className="institute-tutorial-heading"><GraduationCap size={19}/><div><strong>Simulation walkthrough</strong><span>{businessName}</span></div><span>{step === "welcome" ? "Five hands-on steps" : step === "finish" ? "Practice complete" : `Step ${content.progress} of 5`}</span><button type="button" aria-label="Skip simulation walkthrough" disabled={saving || busy} onClick={onSkip}><X size={16}/></button></div>
    <div className="institute-tutorial-progress" aria-hidden="true"><span style={{ transform: `scaleX(${content.progress / 5})` }}/></div>
    <div className="institute-tutorial-body" key={step}><div><h2 tabIndex={-1}>{content.title}</h2><p>{content.detail}</p><span className="institute-tutorial-practice">{step === "welcome" ? "Optional · available again from the Walkthrough button" : "Practice session · your saved run is protected"}</span></div><div className="institute-tutorial-actions"><button type="button" className="btn-primary" disabled={busy || saving} onClick={onAction}>{saving ? <Loader2 size={15}/> : step === "finish" ? <Check size={15}/> : null}{saving ? "Saving progress…" : content.action}{!saving && step !== "finish" && <ArrowRight size={15}/>}</button>{step === "welcome" && <button type="button" className="institute-tutorial-skip" disabled={saving} onClick={onSkip}>I’ll explore on my own</button>}</div></div>
    <span className="institute-tutorial-announcement" role="status">{content.title}</span>
    {error && <div className="institute-tutorial-error" role="alert"><p>{error}</p><button type="button" onClick={onExit}>Exit for now</button></div>}
  </section>;
}
