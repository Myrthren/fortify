import { WorkspaceToolbar } from "./workspace-toolbar";
import Link from "next/link";
import Image from "next/image";
import { Lock, Menu, MessageSquare, Users, LayoutDashboard, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { TIERS } from "@/lib/tiers";
import { isOwner } from "@/lib/owner";
import {
  HUBS, NAV_GROUPS, entryKeys, hubHref, hubMinTier, isLocked, tool,
  type ActiveKey, type NavEntry,
} from "@/lib/tools";
import { handleSignOut } from "@/app/actions/auth";
import { NotificationBell } from "@/components/notification-bell";
import type { Tier } from "@prisma/client";

// Per-tier gradient + glow palette for the subscription badge
const TIER_STYLE: Record<Tier, { a: string; b: string; glow: string; border: string; bg: string }> = {
  FREE:  { a: "#9ca3af", b: "#e5e7eb", glow: "rgba(156,163,175,0.5)",  border: "rgba(156,163,175,0.35)", bg: "rgba(156,163,175,0.08)" },
  PRO:   { a: "#d69130", b: "#f7d477", glow: "rgba(214,145,48,0.6)",   border: "rgba(214,145,48,0.45)",  bg: "rgba(214,145,48,0.10)" },
  ELITE: { a: "#35d9e2", b: "#8ee7ff", glow: "rgba(53,217,226,0.6)",   border: "rgba(53,217,226,0.45)",  bg: "rgba(53,217,226,0.10)" },
  APEX:  { a: "#e74c3c", b: "#ff9a6b", glow: "rgba(231,76,60,0.65)",   border: "rgba(231,76,60,0.5)",    bg: "rgba(231,76,60,0.12)" },
};

const COMMUNITY = [
  { key: "members",     href: "/dashboard/members",     label: "Members" },
  { key: "matchmaking", href: "/dashboard/matchmaking", label: "AI Matchmaking" },
  { key: "deals",       href: "/dashboard/deals",       label: "Deal Board" },
  { key: "pods",        href: "/dashboard/pods",        label: "Mastermind Pods" },
  { key: "forums",      href: "/dashboard/forums",      label: "Forums" },
] as const;

const ACCOUNT = [
  { key: "profile",  href: "/dashboard/profile",  label: "Profile" },
  { key: "settings", href: "/dashboard/settings", label: "Settings" },
  { key: "credits",  href: "/dashboard/credits",  label: "Credits" },
  { key: "support",  href: "/dashboard/support",  label: "Support" },
] as const;

const TOOLS_KEYS     = NAV_GROUPS.flatMap((g) => g.entries.flatMap(entryKeys)) as string[];
const COMMUNITY_KEYS = [...COMMUNITY.map((t) => t.key), "messages", "connections"] as string[];
const ACCOUNT_KEYS   = ACCOUNT.map((t) => t.key) as string[];

// Label, href and lock state for one nav entry, resolved for this user.
function resolveEntry(e: NavEntry, tier: Tier) {
  if (e.kind === "hub") {
    const hub = HUBS[e.hub];
    return { id: e.hub as string, label: hub.label, href: hubHref(e.hub, tier), keys: hub.tabs as string[], locked: isLocked(hubMinTier(e.hub), tier), soon: false };
  }
  const t = tool(e.key)!;
  return { id: t.key as string, label: t.label, href: t.href, keys: [t.key] as string[], locked: isLocked(t.minTier, tier), soon: !!t.soon };
}

function ChevronDown() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ml-1 opacity-60"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function DropdownLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center rounded-md px-3 py-1.5 text-sm transition ${
        active
          ? "bg-white/[0.06] font-medium text-text"
          : "text-text-muted hover:bg-white/[0.04] hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}

// Opens on hover and on keyboard focus, so the menus work without a mouse.
const MENU_PANEL =
  "pointer-events-none absolute top-full translate-y-1 pt-1 opacity-0 transition-all duration-150 ease-out " +
  "group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 " +
  "group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100";

function EntryMarker({ locked, soon }: { locked: boolean; soon: boolean }) {
  if (soon) {
    return <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-text-muted">Soon</span>;
  }
  return locked ? <Lock className="h-3 w-3 text-text-dim opacity-60" aria-label="Locked" /> : null;
}

export function DashboardNav({
  user,
  active,
}: {
  user: {
    email: string | null;
    username?: string | null;
    tier: Tier;
    discordId: string | null;
    credits?: number;
  };
  active: ActiveKey;
}) {
  const tierMeta        = TIERS[user.tier];
  const tierStyle       = TIER_STYLE[user.tier];
  const userIsOwner     = isOwner(user.discordId);
  const toolsActive     = TOOLS_KEYS.includes(active);
  const communityActive = COMMUNITY_KEYS.includes(active);
  const accountActive   = ACCOUNT_KEYS.includes(active);
  const groups          = NAV_GROUPS.map((g) => ({ heading: g.heading, entries: g.entries.map((e) => resolveEntry(e, user.tier)) }));
  const activeHub       = tool(active)?.hub;

  const displayName = user.username ? `@${user.username}` : user.email;

  return (
    <header className="workspace-header sticky top-0 z-40 border-b border-bg-border bg-bg/80 backdrop-blur">
      <div className="workspace-topbar mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">

        {/* ── Left: Logo + primary nav ── */}
        <div className="flex items-center gap-1">
          <Logo withWord />

          <nav className="workspace-primary ml-4 hidden items-center gap-0.5 text-sm sm:flex">
            {/* Dashboard */}
            <Link
              href="/dashboard"
              aria-current={active === "dashboard" ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 transition ${
                active === "dashboard"
                  ? "font-medium text-text"
                  : "text-text-muted hover:bg-white/[0.04] hover:text-text"
              }`}
            >
              <LayoutDashboard className="workspace-nav-icon" size={14}/> Dashboard
            </Link>

            {/* AI Tools dropdown */}
            <div className="group relative">
              <button
                aria-haspopup="true"
                className={`flex items-center rounded-md px-3 py-1.5 transition ${
                  toolsActive
                    ? "font-medium text-text"
                    : "text-text-muted hover:bg-white/[0.04] hover:text-text"
                }`}
              >
                <Sparkles className="workspace-nav-icon" size={14}/> AI Tools
                <ChevronDown />
              </button>
              <div className={`${MENU_PANEL} left-0 w-56`}>
                <div className="w-56 rounded-lg border border-bg-border bg-bg-panel p-1 shadow-xl">
                  {groups.map((group, gi) => (
                    <div key={group.heading}>
                      {gi > 0 && <div className="my-1 border-t border-bg-border" />}
                      <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                        {group.heading}
                      </p>
                      {group.entries.map((item) => (
                        <DropdownLink key={item.id} href={item.href} active={item.keys.includes(active)}>
                          <span className="flex w-full items-center justify-between gap-2">
                            {item.label}
                            <EntryMarker locked={item.locked} soon={item.soon} />
                          </span>
                        </DropdownLink>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Community dropdown */}
            <div className="group relative">
              <button
                aria-haspopup="true"
                className={`flex items-center rounded-md px-3 py-1.5 transition ${
                  communityActive
                    ? "font-medium text-text"
                    : "text-text-muted hover:bg-white/[0.04] hover:text-text"
                }`}
              >
                <Users className="workspace-nav-icon" size={14}/> Community
                <ChevronDown />
              </button>
              <div className={`${MENU_PANEL} left-0 w-48`}>
                <div className="rounded-lg border border-bg-border bg-bg-panel p-1 shadow-xl">
                  {COMMUNITY.map((item) => (
                    <DropdownLink key={item.key} href={item.href} active={active === item.key}>
                      <span className="flex w-full items-center justify-between gap-2">
                        {item.label}
                        {item.key === "matchmaking" && (
                          <EntryMarker locked={isLocked(tool("matchmaking")!.minTier, user.tier)} soon={false} />
                        )}
                      </span>
                    </DropdownLink>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* ── Right: icons + meta + account dropdown ── */}
        <div className="workspace-account-actions flex items-center gap-2 text-sm">

          {/* Notifications bell */}
          <NotificationBell active={active === "notifications"} />

          {/* Connections icon */}
          <Link
            href="/dashboard/connections"
            title="Connections"
            className={`hidden rounded-md p-1.5 transition md:flex ${
              active === "connections"
                ? "text-text"
                : "text-text-muted hover:bg-white/[0.04] hover:text-text"
            }`}
          >
            <Users className="h-4 w-4" />
          </Link>

          {/* Messages icon */}
          <Link
            href="/dashboard/messages"
            title="Messages"
            className={`hidden rounded-md p-1.5 transition md:flex ${
              active === "messages"
                ? "text-text"
                : "text-text-muted hover:bg-white/[0.04] hover:text-text"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
          </Link>

          {/* Username / email display */}
          <span className="workspace-username hidden max-w-[160px] truncate text-text-muted md:inline">
            {displayName}
          </span>

          <span
            className="tier-badge"
            style={{
              ["--tier-a" as string]: tierStyle.a,
              ["--tier-b" as string]: tierStyle.b,
              ["--tier-glow" as string]: tierStyle.glow,
              borderColor: tierStyle.border,
              background: tierStyle.bg,
            } as React.CSSProperties}
          >
            <span className="tier-text">{tierMeta.name}</span>
          </span>

          {userIsOwner && (
            <Link
              href="/admin"
              title="Admin"
              aria-label="Admin"
              className="admin-emblem flex items-center rounded-md p-1 transition hover:bg-white/[0.04]"
            >
              <Image
                src="/fortify-admin.png"
                alt="Admin"
                width={22}
                height={22}
                className="admin-emblem-icon"
              />
            </Link>
          )}

          {/* Account dropdown */}
          <div className="group relative hidden sm:block">
            <button
              aria-haspopup="true"
              className={`flex items-center rounded-md px-3 py-1.5 text-sm transition ${
                accountActive
                  ? "font-medium text-text"
                  : "text-text-muted hover:bg-white/[0.04] hover:text-text"
              }`}
            >
              <span className="workspace-avatar" aria-hidden="true">{(user.username || user.email || "F").slice(0, 1).toUpperCase()}</span> Account
              <ChevronDown />
            </button>
            <div className={`${MENU_PANEL} right-0 w-44`}>
              <div className="rounded-lg border border-bg-border bg-bg-panel p-1 shadow-xl">
                {ACCOUNT.map((item) => (
                  <DropdownLink key={item.key} href={item.href} active={active === item.key}>
                    <span className="flex w-full items-center justify-between">
                      {item.label}
                      {item.key === "credits" && user.credits !== undefined && (
                        <span className="tabular-nums text-xs text-text-muted">
                          {user.credits.toLocaleString()}
                        </span>
                      )}
                    </span>
                  </DropdownLink>
                ))}
                <div className="my-1 border-t border-bg-border" />
                <form action={handleSignOut}>
                  <button className="flex w-full items-center rounded-md px-3 py-1.5 text-sm text-text-muted transition hover:bg-white/[0.04] hover:text-text">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Mobile menu: a native <details> sheet, so it needs no client JS */}
          <details className="workspace-mobile-menu mobile-menu sm:hidden">
            <summary
              aria-label="Open menu"
              className="flex cursor-pointer list-none items-center rounded-md p-1.5 text-text-muted transition hover:bg-white/[0.04] hover:text-text"
            >
              <Menu className="h-5 w-5" />
            </summary>
            <div className="absolute inset-x-0 top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-bg-border bg-bg-panel px-4 pb-6 pt-2 shadow-2xl">
              <MobileSection title="General">
                <MobileLink href="/dashboard" active={active === "dashboard"}>Dashboard</MobileLink>
                <MobileLink href="/dashboard/notifications" active={active === "notifications"}>Notifications</MobileLink>
                <MobileLink href="/dashboard/messages" active={active === "messages"}>Messages</MobileLink>
                <MobileLink href="/dashboard/connections" active={active === "connections"}>Connections</MobileLink>
              </MobileSection>
              {groups.map((group) => (
                <MobileSection key={group.heading} title={group.heading}>
                  {group.entries.map((item) => (
                    <MobileLink key={item.id} href={item.href} active={item.keys.includes(active)}>
                      <span className="flex w-full items-center justify-between gap-2">
                        {item.label}
                        <EntryMarker locked={item.locked} soon={item.soon} />
                      </span>
                    </MobileLink>
                  ))}
                </MobileSection>
              ))}
              <MobileSection title="Community">
                {COMMUNITY.map((item) => (
                  <MobileLink key={item.key} href={item.href} active={active === item.key}>{item.label}</MobileLink>
                ))}
              </MobileSection>
              <MobileSection title="Account">
                {ACCOUNT.map((item) => (
                  <MobileLink key={item.key} href={item.href} active={active === item.key}>{item.label}</MobileLink>
                ))}
                <form action={handleSignOut}>
                  <button className="flex w-full items-center rounded-md px-3 py-2 text-sm text-text-muted transition hover:bg-white/[0.04] hover:text-text">
                    Sign out
                  </button>
                </form>
              </MobileSection>
            </div>
          </details>
        </div>
      </div>

      <WorkspaceToolbar tier={user.tier} credits={user.credits} active={active} />

      {/* ── Hub tabs: the tools a merged section stands in for ── */}
      {activeHub && (
        <div className="border-t border-bg-border">
          <div className="scrollbar-hide mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-1.5 text-sm sm:px-6">
            <span className="mr-2 hidden shrink-0 self-center text-[10px] font-semibold uppercase tracking-wider text-text-dim sm:inline">
              {HUBS[activeHub].label}
            </span>
            {HUBS[activeHub].tabs.map((key) => {
              const t = tool(key)!;
              const on = key === active;
              return (
                <Link
                  key={key}
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                    on ? "bg-white/[0.06] font-medium text-text" : "text-text-muted hover:bg-white/[0.04] hover:text-text"
                  }`}
                >
                  {t.tabLabel ?? t.label}
                  <EntryMarker locked={isLocked(t.minTier, user.tier)} soon={!!t.soon} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}

function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-bg-border py-2 last:border-b-0">
      <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">{title}</p>
      {children}
    </div>
  );
}

function MobileLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center rounded-md px-3 py-2 text-sm transition ${
        active ? "bg-white/[0.06] font-medium text-text" : "text-text-muted hover:bg-white/[0.04] hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}
