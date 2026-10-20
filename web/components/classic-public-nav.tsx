import Link from "next/link";
import { ArrowUpRight, ChevronDown, Compass, Fingerprint, Menu, Radar, Users, Workflow, Zap } from "lucide-react";
import { Logo } from "./logo";

const AREAS = [
  { label:"Leads & outreach", description:"Find prospects and start better conversations", href:"/dashboard/leads", icon:Compass },
  { label:"Content & brand", description:"Write, create and sharpen your voice", href:"/dashboard/voice", icon:Fingerprint },
  { label:"Research & insights", description:"Competitors, trends and business intelligence", href:"/dashboard/competitors", icon:Radar },
  { label:"Workflows", description:"Connect your tools and automate the handoffs", href:"/dashboard/workflows", icon:Workflow },
  { label:"Community", description:"Members, matchmaking and opportunities", href:"/dashboard/members", icon:Users },
] as const;

export function ClassicPublicNav() {
  return <header className="classic-public-header sticky top-0 z-40">
    <div className="classic-public-topbar">
      <div className="classic-public-brand"><Logo withWord/><span>Business, connected.</span></div>
      <nav className="classic-public-primary" aria-label="Main navigation">
        <details className="classic-product-menu"><summary>Explore Fortify <ChevronDown size={12}/></summary><div className="classic-product-dropdown"><p>ONE WORKSPACE. MORE WAYS FORWARD.</p><div>{AREAS.map(area=><Link key={area.label} href={area.href}><span><area.icon size={18}/></span><div><strong>{area.label}</strong><small>{area.description}</small></div><ArrowUpRight size={13}/></Link>)}</div></div></details>
        <Link href="/dashboard/members"><Users size={14}/> Community</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/#faq">FAQ</Link>
      </nav>
      <div className="classic-public-account"><Link href="/login" className="classic-public-login">Log in</Link><Link href="/login" className="btn-primary">Get started <ArrowUpRight size={14}/></Link><details className="classic-public-mobile"><summary aria-label="Open navigation"><Menu size={19}/></summary><nav>{AREAS.map(area=><Link href={area.href} key={area.label}><area.icon size={15}/>{area.label}</Link>)}<Link href="/pricing">Pricing</Link><Link href="/#faq">FAQ</Link><Link href="/login">Log in</Link></nav></details></div>
    </div>
    <div className="classic-public-toolstrip"><div><span className="classic-toolstrip-label"><Zap size={12}/> Your business toolkit</span><nav aria-label="Explore tools">{AREAS.map(area=><Link href={area.href} key={area.label}><area.icon size={12}/>{area.label}</Link>)}</nav><Link href="/#features" className="classic-all-tools">See all tools <ArrowUpRight size={12}/></Link></div></div>
  </header>;
}
