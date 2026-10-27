import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function OperationalDashboardHeader({ name, tier, credits }: { name: string; tier: string; credits: number }) {
  return <header className="workspace-command-heading"><div><h1>Your workspace</h1><p>Welcome back, {name}. Pick up where you left off.</p></div><div className="workspace-account-meta"><span>{tier} plan</span><Link href="/dashboard/credits">{credits.toLocaleString()} credits <ArrowUpRight size={13}/></Link></div></header>;
}
