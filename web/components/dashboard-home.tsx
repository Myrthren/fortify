import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Building2, ChevronDown, Target } from "lucide-react";
import { OperationalDashboardHeader } from "./operational-dashboard-header";
import { WorkspaceActivity } from "./workspace-activity";
import { DashboardDirectory } from "./dashboard-directory";
import { GettingStarted } from "./getting-started";
import { TIERS } from "@/lib/tiers";
import type { Tier } from "@prisma/client";
import type { WorkspaceSnapshot } from "@/lib/workspace-activity";

async function DashboardWork({ snapshot, tier }: { snapshot: WorkspaceSnapshot | Promise<WorkspaceSnapshot>; tier: Tier }) {
  const loaded = await snapshot;
  return <>
    <WorkspaceActivity initial={loaded} tier={tier}/>
    <div id="hook-generator" className="home-legacy-anchor"/>
    <DashboardDirectory tier={tier} initiallyOpen={!loaded.activity.length}/>
  </>;
}

export function DashboardHome({ name, tier, credits, snapshot, hasBusiness = true }: { name: string; tier: Tier; credits: number; snapshot: WorkspaceSnapshot | Promise<WorkspaceSnapshot>; hasBusiness?: boolean }) {
  return <main id="workspace-main" className="dashboard-home">
    <OperationalDashboardHeader name={name} tier={TIERS[tier].name} credits={credits}/>
    {!hasBusiness && <section className="home-business-setup"><Building2 size={20}/><div><strong>Give Fortify a business to operate around.</strong><p>A short setup creates your active context and a practical first operating path.</p></div><Link href="/dashboard/setup">Set up a business <ArrowRight size={13}/></Link></section>}
    {hasBusiness && tier !== "FREE" && <section className="home-business-setup"><Target size={20}/><div><strong>Give your next move a measurable goal.</strong><p>Create a Growth Mission to review prospects and follow progress from your pipeline.</p></div><Link href="/dashboard/missions">Open Growth Missions <ArrowRight size={13}/></Link></section>}
    <Suspense fallback={<div className="workspace-snapshot-loading" role="status"><p>Loading your workspace activity…</p><div className="workspace-skeleton workspace-skeleton-content" aria-hidden="true"/></div>}>
      <DashboardWork snapshot={snapshot} tier={tier}/>
    </Suspense>
    <details className="home-account-help"><summary><span>Account setup &amp; Discord</span><ChevronDown size={16}/></summary><GettingStarted tier={tier}/></details>
  </main>;
}
