import Link from "next/link";
import { ArrowUpRight, Activity } from "lucide-react";
import { SignalField } from "./signal-field";
export function OperationalDashboardHeader({ name, tier, credits }: { name: string; tier: string; credits: number }) {
  return <header className="workspace-command-heading"><div><span className="eyebrow">YOUR BUSINESS / OVERVIEW</span><h1>Welcome back, {name}.</h1><p>Your latest work, the changes that matter, and a clear next move.</p><div className="workspace-account-meta"><span>{tier} workspace</span><Link href="/dashboard/credits">{credits.toLocaleString()} credits <ArrowUpRight size={12}/></Link><Link href="/dashboard/activity"><Activity size={13}/> Open activity</Link></div></div><div className="theme-scifi-only"><div className="workspace-header-signal"><SignalField compact/></div></div></header>;
}
