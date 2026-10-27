"use client";
import { useEffect, useState } from "react";
import { WorkspaceLink as Link } from "./workspace-link";
import { ArrowUpRight, ChevronDown, Lock, Search, Users, Briefcase, MessagesSquare, Network, UserCircle, UsersRound } from "lucide-react";
import { HUBS, NAV_GROUPS, TOOLS, isLocked, tool, type MinTier } from "@/lib/tools";
import { TIERS } from "@/lib/tiers";
import type { Tier } from "@prisma/client";

const sections = NAV_GROUPS.map(group => ({ heading: group.heading, entries: group.entries.flatMap(entry => entry.kind === "hub" ? HUBS[entry.hub].tabs : [entry.key]).map(key => tool(key)!) }));
const community = [
  { key: "members", href: "/dashboard/members", label: "Member Directory", desc: "Founders, operators and creators", icon: Users },
  TOOLS.matchmaking,
  { key: "deals", href: "/dashboard/deals", label: "Deal Board", desc: "Post and browse deals", icon: Briefcase },
  { key: "pods", href: "/dashboard/pods", label: "Mastermind Pods", desc: "Apex accountability circles", icon: UsersRound, minTier: "APEX" as MinTier },
  { key: "forums", href: "/dashboard/forums", label: "Forums", desc: "Community discussion boards", icon: MessagesSquare },
  { key: "messages", href: "/dashboard/messages", label: "Messages", desc: "Chat with members", icon: MessagesSquare },
  { key: "connections", href: "/dashboard/connections", label: "Connections", desc: "Your Fortify network", icon: Network },
  { key: "profile", href: "/dashboard/profile", label: "Your Profile", desc: "Niche, skills and what you offer", icon: UserCircle },
].map(item => ({ minTier: undefined, soon: false, ...item }));
const directory = [...sections, { heading: "Community", entries: community }];

export function DashboardDirectory({ tier, initiallyOpen = false }: { tier: Tier; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen), [query, setQuery] = useState(""), [category, setCategory] = useState("All");
  useEffect(() => { const reveal = () => { if (["#toolkit", "#hook-generator"].includes(window.location.hash)) setOpen(true); }; reveal(); window.addEventListener("hashchange", reveal); return () => window.removeEventListener("hashchange", reveal); }, []);
  const entries = directory.flatMap(group => group.entries.map(item => ({ ...item, category: group.heading }))).filter(item => (category === "All" || category === item.category) && `${item.label} ${item.desc}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <details id="toolkit" className="home-directory" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><div><h2>Explore your toolkit</h2><p>Content, clients, research and the people behind your next move.</p></div><span>{open ? "Hide toolkit" : "Browse tools"}<ChevronDown size={17}/></span></summary>
    <div className="home-directory-body"><label className="home-directory-search"><Search size={16}/><input type="search" aria-label="Filter dashboard tools" placeholder="What would you like to do?" value={query} onChange={event => setQuery(event.target.value)}/></label><nav aria-label="Toolkit categories" className="home-directory-filters">{["All", ...directory.map(group => group.heading)].map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</nav>
      <div className="home-directory-results" aria-live="polite">{entries.length} {entries.length === 1 ? "workspace" : "workspaces"}{category !== "All" ? ` in ${category.toLowerCase()}` : ""}</div>
      <ul className="home-directory-list">{entries.map(item => { const locked = isLocked(item.minTier, tier); const contents = <><item.icon size={18}/><span><strong>{item.label}</strong><small>{item.desc}</small></span>{item.soon ? <em>Soon</em> : locked ? <em><Lock size={11}/>{TIERS[item.minTier!].name}</em> : <ArrowUpRight size={14}/>}</>; return <li key={item.key}>{item.soon ? <div className="home-directory-unavailable">{contents}</div> : <Link href={item.href}>{contents}</Link>}</li>; })}</ul>
      {!entries.length && <div className="home-directory-empty"><h3>No workspaces match that search.</h3><p>Try a task such as “content” or “leads”, or choose another category.</p><button type="button" onClick={() => { setQuery(""); setCategory("All"); }}>Clear filters</button></div>}
    </div>
  </details>;
}
