import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Clock3, FileText, Sparkles, Compass, Fingerprint, Radar, Workflow } from "lucide-react";

export type RecentCreation = { id: string; type: string; title: string; date: string };

export function ClassicDashboardOverview({ firstName, tier, xp, streak, subscription, recentWork = [] }: {
  firstName: string; tier: string; xp: number; streak: number; subscription: string; recentWork?: RecentCreation[];
}) {
  return <>
    <div className="classic-dashboard-heading"><div><span className="classic-overline">YOUR WORKSPACE</span><h1>Welcome back, {firstName}.</h1><p>Leads, content, research and automations. Make your next move.</p></div><span className="classic-tier"><span/>{tier} workspace</span></div>
    <nav className="classic-quick-tools" aria-label="Start with a tool">
      {[{ label:"Find leads", detail:"Prospects & outreach", href:"/dashboard/leads", icon:Compass }, { label:"Create content", detail:"Ideas & your brand voice", href:"/dashboard/voice", icon:Fingerprint }, { label:"Research rivals", detail:"Competitors & trends", href:"/dashboard/competitors", icon:Radar }, { label:"Build a workflow", detail:"Connect your next steps", href:"/dashboard/workflows", icon:Workflow }].map(item=><Link href={item.href} key={item.label}><span><item.icon size={18}/></span><div><strong>{item.label}</strong><small>{item.detail}</small></div><ArrowUpRight size={13}/></Link>)}
    </nav>
    <div className="classic-workspace-grid">
      <section className="classic-next-action">
        <span className="classic-overline"><Sparkles size={13}/> YOUR NEXT MOVE</span>
        <h2>Put your toolkit<br/>to work.</h2>
        <p>Source leads, shape your message and build<br className="hidden sm:inline"/> a repeatable way to move work forward.</p>
        <div className="classic-next-actions"><Link href="#toolkit" className="btn-primary">Explore your toolkit <ArrowRight size={15}/></Link><Link href="/dashboard/content?view=story" className="classic-secondary-action"><Sparkles size={12}/> Build a story</Link></div>
        <div className="classic-brand-orb" aria-hidden="true"><i/><i/><span><Image src="/fortify-mark.png" alt="" width={48} height={48}/></span></div>
      </section>
      <section className="classic-recent-work" aria-label="Recent creations">
        <div className="classic-recent-heading"><h2>Recent creations</h2><Clock3 size={15}/></div>
        {recentWork.length ? <div>{recentWork.map(item=><div className="classic-recent-row" key={item.id}><span className="classic-recent-icon"><FileText size={15}/></span><div><strong>{item.title || "Untitled creation"}</strong><span>{item.type.replace(/[_-]/g," ")} <i>·</i> {item.date}</span></div></div>)}</div> : <div className="classic-recent-empty"><span className="classic-recent-icon"><FileText size={19}/></span><p>Your next idea belongs here.</p><span>Save your first story to start building your collection.</span></div>}
        <Link href="/dashboard/workflows" className="classic-workflow-link">Build a repeatable workflow <ArrowUpRight size={13}/></Link>
      </section>
    </div>
    <div className="classic-account-strip">{[["Membership",tier],["Experience",xp.toLocaleString()],["Current streak",`${streak} days`],["Subscription",subscription]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}{tier === "Free" && <Link href="/pricing">Explore plans <ArrowUpRight size={13}/></Link>}</div>
  </>;
}
