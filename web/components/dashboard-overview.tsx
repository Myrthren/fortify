import { ClassicDashboardOverview, type RecentCreation } from "./classic-dashboard-overview";
import { ParticleField } from "./particle-field";
import Link from "next/link";
import { ArrowUpRight, Compass, Fingerprint, Workflow } from "lucide-react";
import { SignalField } from "./signal-field";

type OverviewProps = { firstName: string; tier: string; xp: number; streak: number; subscription: string; recentWork?: RecentCreation[] };

export function DashboardOverview(props: OverviewProps) {
  const { firstName, tier, xp, streak, subscription } = props;
  return <>
    <div className="theme-original-only"><ClassicDashboardOverview {...props} /></div>
    <div className="theme-scifi-only">
      <div className="dashboard-heading"><div><span className="eyebrow">WORKSPACE / OVERVIEW</span><h1>Welcome back, {firstName}.</h1><p>Your people, your tools, your next move. {tier === "Free" && <Link href="/pricing" className="text-accent hover:underline">Explore plans →</Link>}</p></div><span className="workspace-tag"><span className="signal-dot" /> {tier} workspace</span></div>
      <section className="command-brief">
        <ParticleField className="brief-particle-tide" />
        <div className="brief-copy"><span className="eyebrow">BUILT AROUND YOUR BUSINESS</span><h2>Turn context<br />into your next move.</h2><p>Give Fortify your Company DNA. Bring sharper thinking to every lead, message and decision.</p><Link href="/dashboard/company-dna" className="btn-primary">Open Company DNA <ArrowUpRight size={15} /></Link></div>
        <SignalField compact />
        <div className="brief-links"><Link href="/dashboard/lead-extractor"><Compass size={18} /><span>Find your next lead<small>Start with the right people</small></span><ArrowUpRight size={16} /></Link><Link href="/dashboard/voice"><Fingerprint size={18} /><span>Make it sound like you<small>Shape your brand voice</small></span><ArrowUpRight size={16} /></Link><Link href="/dashboard/workflows"><Workflow size={18} /><span>Move work forward<small>Build a repeatable workflow</small></span><ArrowUpRight size={16} /></Link></div>
      </section>
      <div className="command-stats">{[["MEMBERSHIP", tier], ["EXPERIENCE", xp.toLocaleString()], ["CURRENT STREAK", `${streak} days`], ["SUBSCRIPTION", subscription]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </div>
  </>;
}
