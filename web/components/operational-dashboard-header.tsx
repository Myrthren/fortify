import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SignalField } from "./signal-field";
export function OperationalDashboardHeader({ name, tier, credits }: { name: string; tier: string; credits: number }) {
  return <header className="workspace-command-heading"><div><h1>Welcome back, {name}.</h1><p>Pick up your work, or start something new.</p><div className="workspace-account-meta"><span>{tier} workspace</span><Link href="/dashboard/credits">{credits.toLocaleString()} credits <ArrowUpRight size={12}/></Link></div></div><div className="theme-scifi-only"><div className="workspace-header-signal"><SignalField compact/></div></div></header>;
}
