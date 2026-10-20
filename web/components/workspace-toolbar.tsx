import Link from "next/link";
import { ArrowUpRight, Coins, Compass, Fingerprint, Radar, Activity, Workflow, Layers } from "lucide-react";
import { ToolSearch } from "./tool-search";
import type { Tier } from "@prisma/client";

export function WorkspaceToolbar({ tier, credits, active }: { tier: Tier; credits?: number; active: string }) {
  return <div className="workspace-toolbar"><div className="workspace-toolbar-inner">
    <ToolSearch tier={tier}/>
    <nav aria-label="Workspace shortcuts" className="workspace-shortcuts">
      {[
        { label:"Plans", href:"/dashboard/plans", icon:Layers, keys:["plans"] },
        { label:"Pipeline", href:"/dashboard/pipeline", icon:Compass, keys:["pipeline","leads","lead-extractor","recon","outreach","outbound"] },
        { label:"Content", href:"/dashboard/voice", icon:Fingerprint, keys:["voice","inspiration","virality"] },
        { label:"Research", href:"/dashboard/competitors", icon:Radar, keys:["competitors","competitor-watch","trends"] },
        { label:"Workflows", href:"/dashboard/workflows", icon:Workflow, keys:["workflows"] },
        { label:"Activity", href:"/dashboard/activity", icon:Activity, keys:["activity"] },
      ].map(item=><Link href={item.href} key={item.label} aria-current={item.keys.includes(active) ? "page" : undefined}><item.icon size={13}/>{item.label}</Link>)}
    </nav>
    {credits !== undefined && <Link href="/dashboard/credits" className="workspace-credits"><Coins size={13}/><strong>{credits.toLocaleString()}</strong> credits <ArrowUpRight size={11}/></Link>}
  </div></div>;
}
