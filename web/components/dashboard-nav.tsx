"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, ArrowUpRight, Briefcase, ChevronDown, LayoutDashboard, LayoutGrid, Lock, MessageSquare, Network, Target, Users, UsersRound, type LucideIcon } from "lucide-react";
import { WorkspaceLink as Link } from "./workspace-link";
import { NavigationDisclosure, WorkspaceSkipLink } from "./navigation-disclosure";
import { Logo } from "./logo";
import { ToolSearch } from "./tool-search";
import { NotificationBell } from "./notification-bell";
import { BusinessSwitcher } from "./business-switcher";
import { FortifyAILauncher } from "./fortify-ai-launcher";
import { TIERS } from "@/lib/tiers";
import { workspaceMember, type WorkspaceMember } from "@/lib/workspace-member";
import { NAV_GROUPS, entryKeys, isLocked, tool, workspaceActiveKey, type MinTier } from "@/lib/tools";
import { handleSignOut } from "@/app/actions/auth";
import type { Tier } from "@prisma/client";

type MenuItem = { key: string; href: string; label: string; desc: string; icon: LucideIcon; minTier?: MinTier; soon?: boolean };
const COMMUNITY: MenuItem[] = [
  { key: "members", href: "/dashboard/members", label: "Members", desc: "Meet founders, operators and creators", icon: Users },
  tool("matchmaking")!,
  { key: "deals", href: "/dashboard/deals", label: "Deal Board", desc: "Browse and share opportunities", icon: Briefcase },
  { key: "pods", href: "/dashboard/pods", label: "Mastermind Pods", desc: "Your accountability circle", icon: UsersRound, minTier: "APEX" },
  { key: "forums", href: "/dashboard/forums", label: "Forums", desc: "Join the conversation", icon: MessageSquare },
  { key: "messages", href: "/dashboard/messages", label: "Messages", desc: "Your member conversations", icon: MessageSquare },
  { key: "connections", href: "/dashboard/connections", label: "Connections", desc: "Your Fortify network", icon: Network },
];
const GROUPS = [
  ...NAV_GROUPS.map(group => ({ heading: group.heading, items: group.entries.flatMap(entryKeys).map(key => tool(key)!) as MenuItem[] })),
  { heading: "Community", items: COMMUNITY },
];
const ACCOUNT = [
  { key: "profile", href: "/dashboard/profile", label: "Profile" },
  { key: "settings", href: "/dashboard/settings", label: "Settings" },
  { key: "credits", href: "/dashboard/credits", label: "Credits" },
  { key: "support", href: "/dashboard/support", label: "Support" },
];

function Marker({ item, tier }: { item: MenuItem; tier: Tier }) {
  if (item.soon) return <span className="workspace-nav-tag">Soon</span>;
  return isLocked(item.minTier, tier) ? <span className="workspace-plan-marker"><Lock size={11}/>{TIERS[item.minTier!].name}</span> : null;
}
function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className="workspace-menu-link">{children}</Link>;
}
function Catalog({ active, tier }: { active: string; tier: Tier }) {
  const current = GROUPS.find(group => group.items.some(item => item.key === active))?.heading ?? "Business";
  const [selected, setSelected] = useState(current);
  useEffect(() => { setSelected(current); }, [current, active]);
  const group = GROUPS.find(item => item.heading === selected)!;
  return <>
    <div className="workspace-catalog">
      <nav className="workspace-categories" aria-label="Workspace categories">
        {GROUPS.map(item => <button key={item.heading} type="button" aria-pressed={item.heading === selected} onClick={() => setSelected(item.heading)}><span>{item.heading}</span><small>{item.items.length}</small></button>)}
      </nav>
      <section className="workspace-catalog-section" aria-label={selected}>
        <h2>{selected}</h2>
        <ul className="workspace-catalog-list">{group.items.map(item => {
          const content = <><item.icon size={18}/><span><strong>{item.label}</strong><small>{item.desc}</small></span><Marker item={item} tier={tier}/></>;
          return <li key={item.key}>{item.soon ? <div className="workspace-menu-link workspace-menu-unavailable" aria-disabled="true">{content}</div> : <NavLink href={item.href} active={active === item.key}>{content}</NavLink>}</li>;
        })}</ul>
      </section>
    </div>
    <Link href="/dashboard#toolkit" className="workspace-menu-footer">Browse all workspaces <ArrowUpRight size={14}/></Link>
  </>;
}

export function DashboardNav({ user: initialUser, owner = false }: { user: WorkspaceMember; owner?: boolean }) {
  const pathname = usePathname(), search = useSearchParams();
  const active = workspaceActiveKey(pathname, search.get("assets") === "slideshow" ? "test" : search.get("view"));
  const [user, setUser] = useState(initialUser);
  useEffect(() => { setUser(initialUser); }, [initialUser.email, initialUser.username, initialUser.tier, initialUser.discordId, initialUser.credits]);
  useEffect(() => {
    const update = (event: Event) => setUser(workspaceMember((event as CustomEvent<WorkspaceMember>).detail));
    window.addEventListener("fortify:member-updated", update);
    return () => window.removeEventListener("fortify:member-updated", update);
  }, []);
  const displayName = user.username ? `@${user.username}` : user.email;
  const signOut = <form action={handleSignOut}><button type="submit" className="workspace-menu-signout">Sign out</button></form>;
  const accountLinks = ACCOUNT.map(item => <NavLink key={item.key} href={item.href} active={active === item.key}><span>{item.label}</span>{item.key === "credits" && user.credits !== undefined && <small>{user.credits.toLocaleString()}</small>}</NavLink>);
  const ownerLink = owner && <NavLink href="/admin" active={false}>Administration</NavLink>;
  return <><aside className="command-sidebar" aria-label="Workspace navigation">
    <div className="command-sidebar-brand"><Logo withWord/></div>
    <div className="command-business"><BusinessSwitcher tier={user.tier}/></div>
    <nav className="command-sidebar-scroll">
      <div className="command-primary-links"><NavLink href="/dashboard" active={active === "dashboard"}><LayoutDashboard size={18}/><span>Overview</span></NavLink><NavLink href="/dashboard/missions" active={active === "missions"}><Target size={18}/><span>Growth Missions</span></NavLink><NavLink href="/dashboard/activity" active={active === "activity"}><Activity size={18}/><span>Activity</span></NavLink></div>
      {GROUPS.map(group => <details key={group.heading} className="command-nav-group" open={group.items.some(item => item.key === active)}><summary>{group.heading}<ChevronDown size={14}/></summary><div>{group.items.map(item => item.soon ? <div key={item.key} className="workspace-menu-link workspace-menu-unavailable" aria-disabled="true"><item.icon size={16}/><span>{item.label}</span><Marker item={item} tier={user.tier}/></div> : <NavLink key={item.key} href={item.href} active={active === item.key}><item.icon size={16}/><span>{item.label}</span><Marker item={item} tier={user.tier}/></NavLink>)}</div></details>)}
    </nav>
    <div className="command-sidebar-footer"><NavLink href="/dashboard/settings" active={active === "settings"}>Settings</NavLink><NavLink href="/dashboard/support" active={active === "support"}>Help & support</NavLink>{ownerLink}{signOut}</div>
  </aside><header className="workspace-header workspace-header--focused sticky top-0 z-40">
    <WorkspaceSkipLink/>
    <div className="workspace-topbar">
      <div className="workspace-brand-nav">
        <Logo withWord/>
        <nav className="workspace-primary" aria-label="Main navigation">
          <Link href="/dashboard" aria-current={active === "dashboard" ? "page" : undefined}><LayoutDashboard size={16}/> Dashboard</Link>
          <Link href="/dashboard/missions" aria-current={active === "missions" ? "page" : undefined}><Target size={16}/> Missions</Link>
          <NavigationDisclosure label="Workspaces" icon={<LayoutGrid size={16}/>} active={GROUPS.some(group => group.items.some(item => item.key === active))} className="workspace-tools-menu"><Catalog active={active} tier={user.tier}/></NavigationDisclosure>
          <Link href="/dashboard/activity" aria-current={active === "activity" ? "page" : undefined}><Activity size={16}/> Activity</Link>
        </nav>
      </div>
      <div className="workspace-account-actions">
        <ToolSearch tier={user.tier}/>
        <FortifyAILauncher inline/>
        <NotificationBell active={active === "notifications"}/>
        <NavigationDisclosure label="Account" placement="right" className="workspace-account-menu" active={ACCOUNT.some(item => item.key === active)} icon={<span className="workspace-avatar" aria-hidden="true">{(user.username || user.email || "F").slice(0,1).toUpperCase()}</span>}>
          <div className="workspace-simple-menu">
            <div className="workspace-account-identity"><strong>{displayName}</strong><span>{TIERS[user.tier].name} plan</span></div>
            <BusinessSwitcher tier={user.tier}/>{accountLinks}
            <NavLink href="/dashboard/messages" active={active === "messages"}>Messages</NavLink>
            <NavLink href="/dashboard/connections" active={active === "connections"}>Connections</NavLink>
            {ownerLink}{signOut}
          </div>
        </NavigationDisclosure>
        <NavigationDisclosure label="Navigation" placement="mobile" className="workspace-mobile-menu">
          <div className="workspace-mobile-sheet">
            <BusinessSwitcher tier={user.tier}/>
            <section className="workspace-mobile-primary"><NavLink href="/dashboard" active={active === "dashboard"}>Dashboard</NavLink><NavLink href="/dashboard/missions" active={active === "missions"}>Growth Missions</NavLink><NavLink href="/dashboard/activity" active={active === "activity"}>Activity</NavLink></section>
            {GROUPS.map(group => <details key={group.heading} className="workspace-mobile-group" open={group.items.some(item => item.key === active)}><summary>{group.heading}<ChevronDown size={15}/></summary><div>{group.items.map(item => item.soon ? <div className="workspace-menu-link workspace-menu-unavailable" key={item.key} aria-disabled="true"><span>{item.label}</span><Marker item={item} tier={user.tier}/></div> : <NavLink key={item.key} href={item.href} active={active === item.key}><span>{item.label}</span><Marker item={item} tier={user.tier}/></NavLink>)}</div></details>)}
            <section className="workspace-mobile-account"><h2>{TIERS[user.tier].name} account</h2>{accountLinks}{ownerLink}{signOut}</section>
          </div>
        </NavigationDisclosure>
      </div>
    </div>
  </header></>;
}
