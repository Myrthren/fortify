import { getWorkspaceSnapshot } from "@/lib/workspace-activity";
import { WorkspaceActivity } from "@/components/workspace-activity";
import { OperationalDashboardHeader } from "@/components/operational-dashboard-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIERS } from "@/lib/tiers";
import { DashboardNav } from "@/components/dashboard-nav";
import { GettingStarted } from "@/components/getting-started";
import {
  ArrowRight, Sparkles, Workflow, MessagesSquare, Users, UserCircle,
  Briefcase, UsersRound, MessageSquare, Network, Lock,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { HUBS, NAV_GROUPS, TOOLS, isLocked, tool, type MinTier } from "@/lib/tools";
import type { Tier } from "@prisma/client";

type Tile = { href: string; name: string; desc: string; icon: LucideIcon; minTier?: MinTier; soon?: boolean };

// Every tool, in the nav's order and grouping, so the home grid and the nav never drift.
const TOOL_SECTIONS: { heading: string; tiles: Tile[] }[] = NAV_GROUPS.map((g) => ({
  heading: g.heading,
  tiles: g.entries
    .flatMap((e) => (e.kind === "hub" ? HUBS[e.hub].tabs : [e.key]))
    .map((k) => tool(k)!)
    .map((t) => ({ href: t.href, name: t.label, desc: t.desc, icon: t.icon, minTier: t.minTier, soon: t.soon })),
}));

const COMMUNITY_TILES: Tile[] = [
  { href: "/dashboard/members", name: "Member Directory", desc: "Founders, operators, creators", icon: Users },
  { href: TOOLS.matchmaking.href, name: TOOLS.matchmaking.label, desc: TOOLS.matchmaking.desc, icon: TOOLS.matchmaking.icon, minTier: TOOLS.matchmaking.minTier },
  { href: "/dashboard/deals", name: "Deal Board", desc: "Post and browse deals", icon: Briefcase },
  { href: "/dashboard/pods", name: "Mastermind Pods", desc: "Apex accountability circles", icon: UsersRound, minTier: "APEX" },
  { href: "/dashboard/forums", name: "Forums", desc: "Community discussion boards", icon: MessagesSquare },
  { href: "/dashboard/messages", name: "Messages", desc: "Chat with members", icon: MessageSquare },
  { href: "/dashboard/connections", name: "Connections", desc: "Your Fortify network", icon: Network },
  { href: "/dashboard/profile", name: "Your Profile", desc: "Niche, skills, what you offer", icon: UserCircle },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  if (typeof userId !== "string" || !userId) redirect("/login");
  const [user, snapshot] = await Promise.all([db.user.findUnique({
    where: { id: userId },
  }), getWorkspaceSnapshot(userId)]);
  if (!user) redirect("/login");

  const tierMeta = TIERS[user.tier];
  const firstName = user.name?.split(" ")[0] ?? "operator";

  return (
    <div className="relative min-h-screen">
      <DashboardNav user={user} active="dashboard" />

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <OperationalDashboardHeader name={firstName} tier={tierMeta.name} credits={user.credits}/>
        <WorkspaceActivity initial={snapshot} tier={user.tier}/>

        <GettingStarted tier={user.tier} />

        {/* Old anchor retained for existing bookmarks and onboarding messages. */}
        <div id="hook-generator" className="anim-fade-up anim-d2 mb-10">
          <div className="bento p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="icon-tile h-10 w-10 text-[var(--accent)]"><Sparkles className="h-5 w-5" /></span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">What would you like to work on?</h2>
                <p className="text-sm text-text-muted">Start with a clear task. Keep the evidence, draft and outcome together.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">{[TOOLS.inspiration,TOOLS.story,TOOLS.virality,TOOLS.advisor].map(t=><Link key={t.key} href={t.href} className="rounded-lg border border-bg-border bg-bg-subtle p-4 hover:border-white/30"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{t.label}</h3><ArrowRight size={15}/></div><p className="mt-2 text-xs text-text-muted">{t.desc}</p>{t.minTier&&isLocked(t.minTier,user.tier)&&<span className="mt-2 block text-xs text-text-muted">{t.minTier} plan</span>}</Link>)}</div>
          </div>
        </div>

        {/* Tools grid */}
        <div id="toolkit" className="anim-fade-up anim-d3 mb-6 scroll-mt-32">
          <span className="eyebrow"><Workflow className="h-3.5 w-3.5" /> Your arsenal</span>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Every tool, one click away</h2>
        </div>
        <div className="space-y-8">
          {[...TOOL_SECTIONS, { heading: "Community", tiles: COMMUNITY_TILES }].map((section) => (
            <section key={section.heading}>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-dim">{section.heading}</h3>
              <div className="classic-tool-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.tiles.map((t) => (
                  <ToolTile key={t.href} tile={t} tier={user.tier} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function ToolTile({ tile, tier }: { tile: Tile; tier: Tier }) {
  const locked = isLocked(tile.minTier, tier);
  const dimmed = locked || tile.soon;
  return (
    <Link href={tile.href} className="bento group flex items-start gap-3 p-4">
      <span className={`icon-tile h-10 w-10 shrink-0 ${dimmed ? "text-text-dim" : "text-text-muted"}`}>
        <tile.icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-medium leading-tight ${dimmed ? "text-text-muted" : ""}`}>{tile.name}</p>
          {tile.soon ? (
            <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-text-muted">Soon</span>
          ) : locked ? (
            <span className="flex shrink-0 items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
              <Lock className="h-2.5 w-2.5" /> {TIERS[tile.minTier!].name}
            </span>
          ) : (
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
          )}
        </div>
        <p className="mt-0.5 text-xs leading-snug text-text-muted">{tile.desc}</p>
      </div>
    </Link>
  );
}
