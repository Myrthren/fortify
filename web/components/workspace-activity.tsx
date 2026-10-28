"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, Clock3, Compass, FileText, Radar, RefreshCw, Target, Workflow } from "lucide-react";
import type { WorkspaceSnapshot } from "@/lib/workspace-activity";
import { dashboardPriority } from "@/lib/dashboard-priority";
import { WORKSPACE_GOALS } from "@/lib/workspace-goals";
import { GoalOnboarding } from "./goal-onboarding";

export function WorkspaceActivity({ initial, tier, expanded = false }: { initial: WorkspaceSnapshot; tier: string; expanded?: boolean }) {
  const [snapshot, setSnapshot] = useState(initial), [error, setError] = useState(false), [refreshing, setRefreshing] = useState(false);
  const refreshNow = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let stopped = false, pending = false; const controller = new AbortController();
    async function refresh() {
      if (document.hidden || pending) return;
      pending = true; setRefreshing(true);
      try { const response = await fetch("/api/workspace/activity", { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error(); const data = await response.json(); if (!stopped) { setSnapshot(data); setError(false); } } catch { if (!stopped) setError(true); } finally { pending = false; if (!stopped) setRefreshing(false); }
    }
    refreshNow.current = refresh;
    const interval = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { stopped = true; controller.abort(); clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const priority = dashboardPriority(snapshot, tier), saved = snapshot.activity.filter(item => item.action === "Continue work").slice(0, 3);
  const attention = expanded ? snapshot.attention.slice(0, 8) : snapshot.attention.slice(1, 4);
  const workspaceGoal = WORKSPACE_GOALS.find(goal => goal.value === snapshot.goal);
  const pulse = snapshot.attention[0]
    ? { title: snapshot.attention[0].title, detail: snapshot.attention[0].detail, action: snapshot.attention[0].action, href: snapshot.attention[0].href, urgent: snapshot.attention[0].warning }
    : workspaceGoal
      ? { title: workspaceGoal.label, detail: workspaceGoal.description, action: "Open workspace focus", href: "#workspace-focus", urgent: false }
      : { title: "Set your operating focus", detail: "Tell Fortify whether you are finding clients, creating content, or watching your market.", action: "Choose a focus", href: "#workspace-focus", urgent: false };
  const metrics = [
    { label: "Open prospects", value: snapshot.metrics.openLeads, icon: Compass, href: "/dashboard/pipeline?view=open", note: "In your pipeline" },
    { label: "Follow-ups due", value: snapshot.metrics.dueFollowUps, icon: Clock3, href: "/dashboard/pipeline?view=due", note: "Today or overdue" },
    { label: "Workflows to check", value: snapshot.metrics.failedWorkflows, icon: Workflow, href: "/dashboard/workflows", note: "Latest run failed" },
    { label: "Competitor changes", value: snapshot.metrics.competitorChanges, icon: Radar, href: "/dashboard/competitor-tracking", note: "In the last 7 days" },
  ];
  const icons = { lead: Compass, workflow: Workflow, research: Radar, creation: FileText };
  const time = (value: string) => new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return <div className={`workspace-live ${expanded ? "workspace-history-view" : "workspace-home-view"}`}>
    {!expanded && <div className="home-focus-grid">
      <section className="home-next-action" aria-labelledby="home-next-action"><div className="home-focus-heading"><h2 id="home-next-action">Your next best move</h2><span className={priority.warning ? "home-status is-warning" : "home-status"}>{priority.warning ? <Workflow size={12}/> : <Compass size={12}/>} {priority.label}</span></div><h3>{priority.title}</h3><p>{priority.description}</p><div className="home-next-actions"><Link href={priority.href} className="btn-primary">{priority.action}<ArrowRight size={15}/></Link><Link href="#toolkit">Start something new <ArrowUpRight size={13}/></Link></div></section>
      <aside className="home-operating-brief" aria-labelledby="home-operating-brief"><div className="home-focus-heading"><h2 id="home-operating-brief">Business pulse</h2><Target size={16}/></div><div className="home-pulse-priority"><span className={pulse.urgent ? "home-pulse-dot is-warning" : "home-pulse-dot"}/><div><strong>{pulse.title}</strong><p>{pulse.detail}</p><Link href={pulse.href}>{pulse.action} <ArrowUpRight size={13}/></Link></div></div><div className="home-pulse-summary"><span><strong>{snapshot.metrics.openLeads}</strong> open prospects</span><span><strong>{snapshot.metrics.dueFollowUps}</strong> follow-ups due</span></div><div className="home-resume-work"><div className="home-focus-heading"><h3>Continue work</h3><FileText size={15}/></div>{saved.length ? <ul>{saved.slice(0, 2).map(item => <li key={item.id}><Link href={item.href}><span><small>{item.detail}</small><strong>{item.title}</strong></span><ArrowUpRight size={13}/></Link></li>)}</ul> : <p>Your saved drafts, research and decisions will show up here.</p>}</div></aside>
    </div>}
    <div className="workspace-live-heading"><span><Activity size={14}/> Live business signals</span><div className="workspace-refresh-state"><span role="status">{refreshing ? "Updating…" : error ? "Update unavailable. Your last loaded work is still shown." : <>Updated <time dateTime={snapshot.updatedAt}>{time(snapshot.updatedAt)}</time></>}</span><button type="button" disabled={refreshing} onClick={() => void refreshNow.current()} aria-label="Refresh workspace activity"><RefreshCw size={13} className={refreshing ? "animate-spin" : ""}/><span>Refresh</span></button></div></div>
    <div className="workspace-metrics">{metrics.map(item => <Link href={item.href} key={item.label} title={item.note}><item.icon size={16}/><span>{item.label}</span><strong>{item.value}</strong><ArrowUpRight size={12}/></Link>)}</div>
    <div className="workspace-activity-grid">
      <section className="workspace-feed card"><div className="workspace-section-heading"><h2>Recent activity</h2>{!expanded && <Link href="/dashboard/activity">View history <ArrowUpRight size={13}/></Link>}</div>
        {snapshot.activity.length ? <ol>{snapshot.activity.slice(0, expanded ? 24 : 5).map(item => { const Icon = icons[item.kind]; return <li key={item.id}><span className={`workspace-event-icon ${item.warning ? "warning" : ""}`}><Icon size={15}/></span><div><Link href={item.href}><strong>{item.title}</strong><ArrowUpRight size={12}/></Link><p>{item.detail}</p><time dateTime={item.at}>{time(item.at)}</time></div></li>; })}</ol> : <div className="workspace-empty"><Activity size={24}/><h3>Your first result belongs here.</h3><p>Saved leads, content, workflow runs and research appear as you use Fortify.</p><Link href="/dashboard#toolkit">Explore your toolkit <ArrowUpRight size={13}/></Link></div>}
      </section>
      <section className="workspace-attention card"><div className="workspace-section-heading"><h2>{expanded ? "Needs attention" : "Also on your radar"}</h2><Clock3 size={17}/></div>
        {attention.length ? <ul>{attention.map(item => <li key={item.id}><span className={item.warning ? "workspace-event-dot warning" : "workspace-event-dot"}/><div><strong>{item.title}</strong><p>{item.detail}</p><Link href={item.href}>{item.action} <ArrowUpRight size={12}/></Link></div></li>)}</ul> : <div className="workspace-empty"><CheckCircle2 size={23}/><h3>{snapshot.attention.length ? "One clear next move." : "Nothing needs your attention."}</h3><p>{snapshot.attention.length ? "Your priority is highlighted above. Other due follow-ups and workflow failures will appear here." : "Due follow-ups and workflow failures will appear here when there’s something to review."}</p><Link href="/dashboard/pipeline">Open your pipeline <ArrowUpRight size={13}/></Link></div>}
      </section>
    </div>
    {!expanded && <details id="workspace-focus" className="home-goal-disclosure" open={!snapshot.goal && !snapshot.dismissed}><summary><span>Workspace focus</span><span>Manage your next steps <ChevronDown size={15}/></span></summary><GoalOnboarding initialGoal={initial.goal} initialDismissed={initial.dismissed} signals={snapshot.signals} tier={tier} onPreferenceChange={preference => setSnapshot(previous => ({ ...previous, ...preference }))}/></details>}
  </div>;
}

