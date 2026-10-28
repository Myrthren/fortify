"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Loader2, Minus } from "lucide-react";
import { WorkspaceLink as Link } from "./workspace-link";
import { responseError } from "@/lib/response-error";
import { TIERS } from "@/lib/tiers";
import { WORKSPACE_TUTORIAL_VERSION, type WorkspaceTutorialStatus } from "@/lib/workspace-tutorial";
import type { Tier } from "@prisma/client";

function visibleElement(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(element => element.getClientRects().length > 0);
}
function reveal(selector: string) {
  const trigger = visibleElement(selector);
  if (!trigger) return false;
  if (trigger.getAttribute("aria-expanded") !== "true" && !trigger.closest("details")?.open) trigger.click();
  return true;
}

export function WorkspaceTutorial({ tier }: { tier: Tier }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false), [minimized, setMinimized] = useState(false);
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [businessSeen, setBusinessSeen] = useState(false);
  const panel = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null), resume = useRef<HTMLButtonElement>(null), pending = useRef(false);
  const replaying = useRef(false), loading = useRef(0), restoreFocus = useRef<HTMLElement | null>(null), lastRoute = useRef(pathname);
  const load = useCallback(async (replay = false) => {
    const request = ++loading.current;
    try {
      const response = await fetch("/api/workspace/tutorial", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      const data: WorkspaceTutorialStatus = await response.json();
      if (request !== loading.current) return;
      if (replay || (data.autoStart && !replaying.current)) {
        restoreFocus.current = document.activeElement as HTMLElement;
        replaying.current = replay;
        setStep(replay ? 0 : Math.min(4, Math.max(0, data.state?.step ?? 0)));
        setBusinessSeen(false); setError(""); setMinimized(false); setOpen(true);
      }
    } catch {
      // Automatic guidance never blocks the workspace if storage is unavailable.
      if (replay && request === loading.current) { setError("The tutorial could not load. Try Replay tutorial again."); setOpen(true); setMinimized(false); }
    }
  }, []);

  useEffect(() => {
    void load();
    const replay = () => { void load(true); };
    window.addEventListener("fortify:tutorial-replay", replay);
    return () => { loading.current++; window.removeEventListener("fortify:tutorial-replay", replay); };
  }, [tier, load]);

  const save = useCallback(async (next: number, action = "advance") => {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/workspace/tutorial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: WORKSPACE_TUTORIAL_VERSION, action, step: next }) });
      if (!response.ok) throw new Error(await responseError(response));
      if (action === "advance") setStep(next);
      else { setOpen(false); restoreFocus.current?.isConnected && restoreFocus.current.focus({ preventScroll: true }); }
      return true;
    } catch { setError("Your progress could not be saved. Try again, or close for now and return later."); return false; }
    finally { pending.current = false; setBusy(false); }
  }, []);

  useEffect(() => { if (open) (minimized ? resume.current : heading.current)?.focus({ preventScroll: true }); }, [open, minimized, step]);
  useEffect(() => {
    if (!open) return;
    const checkBusiness = () => {
      if (visibleElement('.workspace-account-menu[data-open="true"], .workspace-mobile-menu[data-open="true"]')) setBusinessSeen(true);
    };
    checkBusiness();
    window.addEventListener("fortify:navigation-open", checkBusiness);
    return () => window.removeEventListener("fortify:navigation-open", checkBusiness);
  }, [open]);

  useEffect(() => {
    if (!open || busy) return;
    const moved = lastRoute.current !== pathname;
    lastRoute.current = pathname;
    if (!moved) return;
    if (step === 2 && (pathname === "/dashboard/plans" || pathname.startsWith("/dashboard/plans/"))) void save(3);
    if (step === 3 && pathname === "/dashboard/activity") void save(4);
  }, [open, step, pathname, busy, save]);

  useEffect(() => {
    if (!open || minimized) return;
    let target: HTMLElement | undefined;
    const highlight = () => {
      target?.removeAttribute("data-workspace-tutorial-target");
      const selector = step === 1 ? ".workspace-account-menu > button, .workspace-mobile-menu > button" : step === 2 ? ".workspace-search" : step === 3 ? '.workspace-primary > a[href="/dashboard/activity"], .workspace-mobile-menu > button' : step === 4 ? ".workspace-ai-launcher" : "";
      target = selector ? visibleElement(selector) : undefined;
      target?.setAttribute("data-workspace-tutorial-target", "true");
    };
    highlight(); window.addEventListener("resize", highlight);
    return () => { target?.removeAttribute("data-workspace-tutorial-target"); window.removeEventListener("resize", highlight); };
  }, [open, minimized, step]);

  if (!open) return null;
  const titles = ["Welcome to your Fortify workspace.", "Give your tools shared context.", "Find the right workspace.", "Your work stays with you.", "Get help while you work."];
  const closeForNow = () => { loading.current++; setOpen(false); restoreFocus.current?.isConnected && restoreFocus.current.focus({ preventScroll: true }); };
  const finish = async (assistant = false) => { if (await save(4, "complete")) { if (assistant) visibleElement(".workspace-ai-launcher")?.click(); } };
  return createPortal(minimized ? <button ref={resume} className="workspace-tutorial-resume" type="button" onClick={() => setMinimized(false)}><GraduationCap size={16}/> Resume tutorial <span>{step + 1}/5</span></button> : <aside ref={panel} className="workspace-tutorial" aria-label="Fortify workspace tutorial" aria-busy={busy} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setMinimized(true); } }}>
    <div className="workspace-tutorial-top"><span><GraduationCap size={17}/> Workspace tutorial</span><div><button type="button" aria-label="Minimize tutorial" onClick={() => setMinimized(true)}><Minus size={17}/></button><button type="button" disabled={busy} onClick={() => void save(step, "skip")}>Skip tutorial</button></div></div>
    <div className="workspace-tutorial-progress" aria-label={`Step ${step + 1} of 5`}>{titles.map((title, index) => <span key={title} data-complete={index <= step}/>)}</div>
    <div className="workspace-tutorial-copy"><p className="workspace-tutorial-count">{step + 1} of 5{step === 0 ? ` · ${TIERS[tier].name} plan` : ""}</p><h2 ref={heading} tabIndex={-1}>{titles[step]}</h2>
      {step === 0 && <><p>Fortify brings your business context, tools and saved work into one place. This short tutorial shows you how they fit together.</p><p className="workspace-tutorial-note">You’ll open real controls. No AI requests, messages or paid actions run as part of this tutorial.</p></>}
      {step === 1 && <><p>{tier === "FREE" ? "Your account menu holds your profile and settings. Paid plans also let you save businesses and switch their context." : "Business Setup saves what you do and who you serve. Choosing a business gives supported tools that context, so you don’t need to start from scratch each time."}</p><p className="workspace-tutorial-note">Open the highlighted menu to find business selection, setup and your account.</p></>}
      {step === 2 && <><p>Use Workspaces to browse by task, or Search to find a tool directly. Search for <strong>Plans</strong>, then open the result.</p><p className="workspace-tutorial-note">Plans keeps goals and tasks together. Opening it doesn’t create or run anything.</p></>}
      {step === 3 && <><p>Work you save stays in its own workspace. Activity brings recent results, lead updates and workflow runs together so you can pick up where you left off.</p><p className="workspace-tutorial-note">Open Activity next. A new account may be empty until you save your first result.</p></>}
      {step === 4 && <><p>Ask Fortify AI from the header when you need help. Tools can use credits or your plan’s AI allowance; review the usage information before running work.</p><p className="workspace-tutorial-note">You can replay this tutorial any time in <Link href="/dashboard/settings">Settings</Link>. When you’re ready to act, <Link href="/dashboard/missions">create a Growth Mission</Link>.</p></>}
    </div>
    {error && <div className="workspace-tutorial-error" role="alert"><p>{error}</p><button type="button" onClick={closeForNow}>Close for now</button></div>}
    <div className="workspace-tutorial-actions">
      {step > 0 && <button className="workspace-tutorial-back" type="button" aria-label="Previous tutorial step" disabled={busy} onClick={() => { setStep(value => value - 1); setError(""); }}><ArrowLeft size={16}/></button>}
      {step === 0 && <button type="button" className="btn-primary" disabled={busy} onClick={() => void save(1)}>{busy ? <Loader2 size={15}/> : null} Start tutorial <ArrowRight size={15}/></button>}
      {step === 1 && <><button type="button" className="btn-secondary" disabled={busy} onClick={() => reveal(".workspace-account-menu > button, .workspace-mobile-menu > button")}>Show account menu</button><button type="button" className="btn-primary" disabled={busy || !businessSeen} onClick={() => void save(2)}>Next <ArrowRight size={15}/></button></>}
      {step === 2 && <><button type="button" className="btn-primary" disabled={busy} onClick={() => reveal(".workspace-search > summary")}>Open search <ArrowRight size={15}/></button><Link href="/dashboard/plans" onClick={() => { if (pathname === "/dashboard/plans" || pathname.startsWith("/dashboard/plans/")) void save(3); }}>Open Plans directly</Link></>}
      {step === 3 && <Link href="/dashboard/activity" className="btn-primary" onClick={() => { if (pathname === "/dashboard/activity") void save(4); }}>Open Activity <ArrowRight size={15}/></Link>}
      {step === 4 && <><button type="button" className="btn-primary" disabled={busy} onClick={() => void finish()}>{busy ? <Loader2 size={15}/> : <Check size={15}/>} Finish tutorial</button><button type="button" disabled={busy} onClick={() => void finish(true)}>Finish and open AI</button></>}
    </div>
    <span className="workspace-tutorial-announcement" role="status">Step {step + 1} of 5. {titles[step]}</span>
  </aside>, document.body);
}
