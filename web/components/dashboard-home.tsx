import Link from "next/link";
import { ArrowRight, Building2, ChevronDown } from "lucide-react";
import { OperationalDashboardHeader } from "./operational-dashboard-header";
import { WorkspaceActivity } from "./workspace-activity";
import { DashboardDirectory } from "./dashboard-directory";
import { GettingStarted } from "./getting-started";
import { TIERS } from "@/lib/tiers";
import type { Tier } from "@prisma/client";
import type { WorkspaceSnapshot } from "@/lib/workspace-activity";

export function DashboardHome({ name, tier, credits, snapshot, hasBusiness = true }: { name: string; tier: Tier; credits: number; snapshot: WorkspaceSnapshot; hasBusiness?: boolean }) {
  return <main id="workspace-main" className="dashboard-home">
    <OperationalDashboardHeader name={name} tier={TIERS[tier].name} credits={credits}/>
    {!hasBusiness && <section className="home-business-setup"><Building2 size={20}/><div><strong>Give Fortify a business to operate around.</strong><p>A short setup creates your active context and a practical first operating path.</p></div><Link href="/dashboard/setup">Set up a business <ArrowRight size={13}/></Link></section>}
    <WorkspaceActivity initial={snapshot} tier={tier}/>
    <div id="hook-generator" className="home-legacy-anchor"/>
    <DashboardDirectory tier={tier} initiallyOpen={!snapshot.activity.length}/>
    <details className="home-account-help"><summary><span>Account setup &amp; Discord</span><ChevronDown size={16}/></summary><GettingStarted tier={tier}/></details>
  </main>;
}
