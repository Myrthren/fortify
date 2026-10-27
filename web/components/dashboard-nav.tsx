"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { WorkspaceLink as Link } from "./workspace-link";
import Image from "next/image";
import { Activity, ArrowUpRight, LayoutDashboard, Lock, MessageSquare, Users, LayoutGrid } from "lucide-react";
import { WorkspaceToolbar } from "./workspace-toolbar";
import { NavigationDisclosure, WorkspaceSkipLink } from "./navigation-disclosure";
import { Logo } from "./logo";
import { NotificationBell } from "./notification-bell";
import { BusinessSwitcher } from "./business-switcher";
import { TIERS } from "@/lib/tiers";
import { workspaceMember, type WorkspaceMember } from "@/lib/workspace-member";
import { HUBS, NAV_GROUPS, entryKeys, hubHref, hubMinTier, isLocked, tool, workspaceActiveKey, type NavEntry } from "@/lib/tools";
import { handleSignOut } from "@/app/actions/auth";
import type { Tier } from "@prisma/client";

const TIER_STYLE: Record<Tier, { a: string; b: string; glow: string; border: string; bg: string }> = {
  FREE: { a: "#9ca3af", b: "#e5e7eb", glow: "rgba(156,163,175,.5)", border: "rgba(156,163,175,.35)", bg: "rgba(156,163,175,.08)" },
  PRO: { a: "#d69130", b: "#f7d477", glow: "rgba(214,145,48,.6)", border: "rgba(214,145,48,.45)", bg: "rgba(214,145,48,.10)" },
  ELITE: { a: "#35d9e2", b: "#8ee7ff", glow: "rgba(53,217,226,.6)", border: "rgba(53,217,226,.45)", bg: "rgba(53,217,226,.10)" },
  APEX: { a: "#e74c3c", b: "#ff9a6b", glow: "rgba(231,76,60,.65)", border: "rgba(231,76,60,.5)", bg: "rgba(231,76,60,.12)" },
};
const COMMUNITY = [
  { key: "members", href: "/dashboard/members", label: "Members" },
  { key: "matchmaking", href: "/dashboard/matchmaking", label: "AI Matchmaking" },
  { key: "deals", href: "/dashboard/deals", label: "Deal Board" },
  { key: "pods", href: "/dashboard/pods", label: "Mastermind Pods" },
  { key: "forums", href: "/dashboard/forums", label: "Forums" },
] as const;
const ACCOUNT = [
  { key: "profile", href: "/dashboard/profile", label: "Profile" },
  { key: "settings", href: "/dashboard/settings", label: "Settings" },
  { key: "credits", href: "/dashboard/credits", label: "Credits" },
  { key: "support", href: "/dashboard/support", label: "Support" },
] as const;
const TOOLS_KEYS = NAV_GROUPS.flatMap(group => group.entries.flatMap(entryKeys)) as string[];
function resolveEntry(entry: NavEntry, tier: Tier) {
  if (entry.kind === "hub") { const hub = HUBS[entry.hub]; return { id: entry.hub, label: hub.label, description: hub.desc, icon: hub.icon, href: hubHref(entry.hub, tier), keys: hub.tabs as string[], locked: isLocked(hubMinTier(entry.hub), tier), soon: false }; }
  const item = tool(entry.key)!;
  return { id: item.key, label: item.label, description: item.desc, icon: item.icon, href: item.href, keys: [item.key] as string[], locked: isLocked(item.minTier, tier), soon: !!item.soon };
}
function Marker({ locked, soon }: { locked: boolean; soon?: boolean }) { return soon ? <span className="workspace-nav-tag">Soon</span> : locked ? <Lock size={12} aria-label="Requires a higher plan"/> : null; }
function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) { return <Link href={href} aria-current={active ? "page" : undefined} className="workspace-menu-link">{children}</Link>; }

export function DashboardNav({ user: initialUser, owner = false }: { user: WorkspaceMember; owner?: boolean }) {
  const pathname = usePathname(), search = useSearchParams();
  const active = workspaceActiveKey(pathname, search.get("assets") === "slideshow" ? "test" : search.get("view"));
  const [user, setUser] = useState(initialUser);
  useEffect(() => { setUser(initialUser); }, [initialUser]);
  useEffect(() => {
    const update = (event: Event) => setUser(workspaceMember((event as CustomEvent<WorkspaceMember>).detail));
    window.addEventListener("fortify:member-updated", update);
    return () => window.removeEventListener("fortify:member-updated", update);
  }, []);
  const groups = NAV_GROUPS.map(group => ({ heading: group.heading, entries: group.entries.map(entry => resolveEntry(entry, user.tier)) }));
  const tierStyle = TIER_STYLE[user.tier], tierMeta = TIERS[user.tier], activeHub = tool(active)?.hub;
  const displayName = user.username ? `@${user.username}` : user.email;
  const signOut = <form action={handleSignOut}><button type="submit" className="workspace-menu-signout">Sign out</button></form>;
  const communityLinks = COMMUNITY.map(item => <NavLink key={item.key} href={item.href} active={active === item.key}><span>{item.label}</span>{item.key === "matchmaking" && <Marker locked={isLocked(tool("matchmaking")!.minTier, user.tier)}/>}</NavLink>);
  const accountLinks = ACCOUNT.map(item => <NavLink key={item.key} href={item.href} active={active === item.key}><span>{item.label}</span>{item.key === "credits" && user.credits !== undefined && <small>{user.credits.toLocaleString()}</small>}</NavLink>);
  return <header className="workspace-header sticky top-0 z-40">
    <WorkspaceSkipLink/>
    <div className="workspace-topbar">
      <div className="workspace-brand-nav"><Logo withWord/>
        <nav className="workspace-primary" aria-label="Main navigation">
          <Link href="/dashboard" aria-current={active === "dashboard" ? "page" : undefined}><LayoutDashboard size={15}/> Dashboard</Link>
          <NavigationDisclosure label="Workspaces" icon={<LayoutGrid size={15}/>} active={TOOLS_KEYS.includes(active)} className="workspace-tools-menu"><div className="workspace-mega-menu">{groups.map(group => <section key={group.heading}><h2>{group.heading}</h2>{group.entries.map(item => <NavLink key={item.id} href={item.href} active={item.keys.includes(active)}><item.icon size={17}/><span><strong>{item.label}</strong><small>{item.description}</small></span><Marker locked={item.locked} soon={item.soon}/></NavLink>)}</section>)}</div><Link href="/dashboard#toolkit" className="workspace-menu-footer">Browse the full toolkit <ArrowUpRight size={13}/></Link></NavigationDisclosure>
          <Link href="/dashboard/activity" aria-current={active === "activity" ? "page" : undefined}><Activity size={15}/> Activity</Link>
          <NavigationDisclosure label="Community" icon={<Users size={15}/>} active={[...COMMUNITY.map(item => item.key), "connections", "messages"].includes(active)}><div className="workspace-simple-menu">{communityLinks}</div></NavigationDisclosure>
        </nav>
      </div>
      <div className="workspace-account-actions">
        <NotificationBell active={active === "notifications"}/>
        <Link href="/dashboard/messages" title="Messages" aria-label="Messages" aria-current={active === "messages" ? "page" : undefined} className="workspace-messages-link"><MessageSquare size={17}/></Link>
        <span className="workspace-username">{displayName}</span>
        <span className="tier-badge" style={{ ["--tier-a" as string]: tierStyle.a, ["--tier-b" as string]: tierStyle.b, ["--tier-glow" as string]: tierStyle.glow, borderColor: tierStyle.border, background: tierStyle.bg } as React.CSSProperties}><span className="tier-text">{tierMeta.name}</span></span>
        {owner && <Link href="/admin" title="Admin" aria-label="Admin" className="admin-emblem"><Image src="/fortify-admin.png" alt="Admin" width={22} height={22} className="admin-emblem-icon"/></Link>}
        <NavigationDisclosure label="Account" placement="right" className="workspace-account-menu" active={ACCOUNT.some(item => item.key === active)} icon={<span className="workspace-avatar" aria-hidden="true">{(user.username || user.email || "F").slice(0,1).toUpperCase()}</span>}><div className="workspace-simple-menu"><p className="workspace-account-name">{displayName}</p><BusinessSwitcher tier={user.tier}/>{accountLinks}<NavLink href="/dashboard/connections" active={active === "connections"}>Connections</NavLink>{signOut}</div></NavigationDisclosure>
        <NavigationDisclosure label="Navigation" placement="mobile" className="workspace-mobile-menu"><div className="workspace-mobile-sheet"><BusinessSwitcher tier={user.tier}/><section><h2>Your workspace</h2><NavLink href="/dashboard" active={active === "dashboard"}>Dashboard</NavLink><NavLink href="/dashboard/activity" active={active === "activity"}>Activity</NavLink><NavLink href="/dashboard/notifications" active={active === "notifications"}>Notifications</NavLink><NavLink href="/dashboard/messages" active={active === "messages"}>Messages</NavLink></section>{groups.map(group => <section key={group.heading}><h2>{group.heading}</h2>{group.entries.map(item => <NavLink key={item.id} href={item.href} active={item.keys.includes(active)}><span>{item.label}</span><Marker locked={item.locked} soon={item.soon}/></NavLink>)}</section>)}<section><h2>Community</h2>{communityLinks}</section><section><h2>Account</h2>{accountLinks}<NavLink href="/dashboard/connections" active={active === "connections"}>Connections</NavLink>{signOut}</section></div></NavigationDisclosure>
      </div>
    </div>
    <WorkspaceToolbar tier={user.tier} credits={user.credits} active={active}/>
    {activeHub && <nav aria-label={`${HUBS[activeHub].label} sections`} className="workspace-hub-tabs"><span>{HUBS[activeHub].label}</span>{HUBS[activeHub].tabs.map(key => { const item = tool(key)!; return <Link key={key} href={item.href} aria-current={key === active ? "page" : undefined}>{item.tabLabel ?? item.label}<Marker locked={isLocked(item.minTier,user.tier)} soon={item.soon}/></Link>; })}</nav>}
  </header>;
}
