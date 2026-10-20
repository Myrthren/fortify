"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, Clock3, Compass, FileText, Radar, RefreshCw, Workflow } from "lucide-react";
import type { WorkspaceSnapshot } from "@/lib/workspace-activity";
import { GoalOnboarding } from "./goal-onboarding";

export function WorkspaceActivity({ initial, tier, expanded = false }: { initial: WorkspaceSnapshot; tier: string; expanded?: boolean }) {
  const [snapshot, setSnapshot] = useState(initial), [error, setError] = useState(false), [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let stopped = false, pending = false; const controller = new AbortController();
    async function refresh() {
      if (document.hidden || pending) return;
      pending = true; setRefreshing(true);
      try { const response = await fetch("/api/workspace/activity", { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error(); const data = await response.json(); if (!stopped) { setSnapshot(data); setError(false); } } catch { if (!stopped) setError(true); } finally { pending = false; if (!stopped) setRefreshing(false); }
    }
    const interval = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { stopped = true; controller.abort(); clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const metrics = [
    { label: "Open prospects", value: snapshot.metrics.openLeads, icon: Compass, href: "/dashboard/pipeline?view=open", note: "In your pipeline" },
    { label: "Follow-ups due", value: snapshot.metrics.dueFollowUps, icon: Clock3, href: "/dashboard/pipeline?view=due", note: "Today or overdue" },
    { label: "Workflows to check", value: snapshot.metrics.failedWorkflows, icon: Workflow, href: "/dashboard/workflows", note: "Latest run failed" },
    { label: "Competitor changes", value: snapshot.metrics.competitorChanges, icon: Radar, href: "/dashboard/competitor-tracking", note: "Detected in the last 7 days" },
  ];
  const icons = { lead: Compass, workflow: Workflow, research: Radar, creation: FileText };
  return <div className="workspace-live">
    {!expanded && <GoalOnboarding initialGoal={initial.goal} initialDismissed={initial.dismissed} signals={snapshot.signals} tier={tier}/>}
    <div className="workspace-live-heading"><span><Activity size={14}/> Your workspace activity</span><span>{refreshing ? <><RefreshCw size={12} className="animate-spin"/> Updating</> : error ? "Update unavailable · showing last loaded activity" : "Updates every minute"}</span></div>
    <div className="workspace-metrics">{metrics.map(item => <Link href={item.href} key={item.label}><div><item.icon size={16}/><ArrowUpRight size={13}/></div><strong>{item.value}</strong><span>{item.label}</span><small>{item.note}</small></Link>)}</div>
    <div className="workspace-activity-grid">
      <section className="workspace-attention card"><div className="workspace-section-heading"><div><span className="eyebrow">NEEDS YOUR ATTENTION</span><h2>Your next moves</h2></div><Clock3 size={18}/></div>
        {snapshot.attention.length ? <ul>{snapshot.attention.slice(0, expanded ? 8 : 4).map(item => <li key={item.id}><span className={item.warning ? "workspace-event-dot warning" : "workspace-event-dot"}/><div><strong>{item.title}</strong><p>{item.detail}</p><Link href={item.href}>{item.action} <ArrowUpRight size={12}/></Link></div></li>)}</ul> : <div className="workspace-empty"><CheckMark/><h3>No follow-ups or failed workflows to check.</h3><p>Save a prospect and set a follow-up date to put your next step here.</p><Link href="/dashboard/pipeline">Open your pipeline <ArrowUpRight size={13}/></Link></div>}
      </section>
      <section className="workspace-feed card"><div className="workspace-section-heading"><div><span className="eyebrow">LATEST ACTIVITY</span><h2>Work in motion</h2></div>{!expanded && <Link href="/dashboard/activity">View history <ArrowUpRight size={13}/></Link>}</div>
        {snapshot.activity.length ? <ol>{snapshot.activity.slice(0, expanded ? 24 : 6).map(item => { const Icon = icons[item.kind]; return <li key={item.id}><span className={`workspace-event-icon ${item.warning ? "warning" : ""}`}><Icon size={15}/></span><div><Link href={item.href}><strong>{item.title}</strong><ArrowUpRight size={12}/></Link><p>{item.detail}</p><time dateTime={item.at}>{new Date(item.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</time></div></li>; })}</ol> : <div className="workspace-empty"><Activity size={24}/><h3>Your work starts here.</h3><p>Saved leads, generated results, workflow runs and competitor changes will appear as you use Fortify.</p><Link href="/dashboard#toolkit">Explore your toolkit <ArrowUpRight size={13}/></Link></div>}
      </section>
    </div>
  </div>;
}
function CheckMark() { return <span className="workspace-empty-check">✓</span>; }
