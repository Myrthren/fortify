import Link from "next/link";
import { Lock, MessageSquare, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { TIERS } from "@/lib/tiers";
import { isOwner } from "@/lib/owner";
import { handleSignOut } from "@/app/actions/auth";
import { NotificationBell } from "@/components/notification-bell";
import type { Tier } from "@prisma/client";


type ActiveKey =
  | "dashboard"
  | "voice"
  | "outreach"
  | "audit"
  | "trends"
  | "competitors"
  | "matchmaking"
  | "inspiration"
  | "leads"
  | "ads"
  | "analytics"
  | "shopify"
  | "revenue"
  | "virality"
  | "dna"
  | "logo"
  | "members"
  | "deals"
  | "pods"
  | "forums"
  | "messages"
  | "connections"
  | "notifications"
  | "profile"
  | "settings"
  | "support"
  | "credits"
  | "recon"
  | "competitor-watch"
  | "workflows"
  | "advisor";

type ToolItem = { key: string; href: string; label: string; badge?: string | null; minTier?: "PRO" | "ELITE" | "APEX" };

const TOOL_GROUPS: { heading: string; items: ToolItem[] }[] = [
  {
    heading: "Content",
    items: [
      { key: "voice",       href: "/dashboard/voice",       label: "Brand Voice",       minTier: "PRO" },
      { key: "inspiration", href: "/dashboard/inspiration", label: "Inspiration",        minTier: "PRO" },
      { key: "virality",    href: "/dashboard/virality",    label: "Virality Engine",    minTier: "ELITE" },
      { key: "logo",        href: "/dashboard/logo",        label: "Logo Intelligence",  minTier: "PRO" },
    ],
  },
  {
    heading: "Growth",
    items: [
      { key: "outreach",    href: "/dashboard/outreach",    label: "Outreach",           minTier: "PRO" },
      { key: "leads",       href: "/dashboard/leads",       label: "Lead Sourcing",      minTier: "PRO" },
      { key: "matchmaking", href: "/dashboard/matchmaking", label: "Matchmaking",        minTier: "PRO" },
      { key: "recon", href: "/dashboard/recon", label: "Fortify Recon", minTier: "ELITE" as const },
    ],
  },
  {
    heading: "Research",
    items: [
      { key: "audit",       href: "/dashboard/audit",       label: "Funnel Audit",       minTier: "PRO" },
      { key: "trends",      href: "/dashboard/trends",      label: "Trend Radar",        minTier: "PRO" },
      { key: "competitors", href: "/dashboard/competitors", label: "Competitors",        minTier: "PRO" },
      { key: "competitor-watch", href: "/dashboard/competitor-tracking", label: "Competitor Watch", minTier: "ELITE" as const },
    ],
  },
  {
    heading: "Business",
    items: [
      { key: "ads",         href: "/dashboard/ads",         label: "Meta Ads",           minTier: "PRO" },
      { key: "shopify",     href: "/dashboard/shopify",     label: "Shopify",            minTier: "PRO" },
      { key: "revenue",     href: "/dashboard/revenue",     label: "Revenue",            minTier: "PRO" },
      { key: "dna",         href: "/dashboard/company-dna", label: "Company DNA",        minTier: "PRO" },
      { key: "analytics",   href: "/dashboard/analytics",   label: "Analytics" },
    ],
  },
  {
    heading: "Automation",
    items: [
      { key: "workflows", href: "/dashboard/workflows", label: "Workflows",   minTier: "ELITE" as const },
    ],
  },
  {
    heading: "Apex",
    items: [
      { key: "advisor",   href: "/dashboard/advisor",   label: "AI Advisor",  minTier: "APEX" as const },
    ],
  },
];

const TOOLS_KEYS = TOOL_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const COMMUNITY = [
  { key: "members",     href: "/dashboard/members",     label: "Members" },
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

const ALL_MOBILE = [
  { key: "dashboard",     href: "/dashboard",                label: "Dashboard" },
  ...TOOL_GROUPS.flatMap((g) => g.items),
  ...COMMUNITY,
  { key: "messages",      href: "/dashboard/messages",       label: "Messages" },
  { key: "connections",   href: "/dashboard/connections",    label: "Connections" },
  { key: "notifications", href: "/dashboard/notifications",  label: "Notifications" },
  ...ACCOUNT,
];

const COMMUNITY_KEYS  = [...COMMUNITY.map((t) => t.key), "messages", "connections"] as string[];
const ACCOUNT_KEYS    = ACCOUNT.map((t) => t.key) as string[];

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
  const userIsOwner     = isOwner(user.discordId);
  const toolsActive     = TOOLS_KEYS.includes(active as string);
  const communityActive = COMMUNITY_KEYS.includes(active as string);
  const accountActive   = ACCOUNT_KEYS.includes(active as string);

  const displayName = user.username ? `@${user.username}` : user.email;

  return (
    <header className="sticky top-0 z-40 border-b border-bg-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">

        {/* ── Left: Logo + primary nav ── */}
        <div className="flex items-center gap-1">
          <Logo withWord />

          <nav className="ml-4 hidden items-center gap-0.5 text-sm sm:flex">
            {/* Dashboard */}
            <Link
              href="/dashboard"
              className={`rounded-md px-3 py-1.5 transition ${
                active === "dashboard"
                  ? "font-medium text-text"
                  : "text-text-muted hover:bg-white/[0.04] hover:text-text"
              }`}
            >
              Dashboard
            </Link>

            {/* AI Tools dropdown */}
            <div className="group relative">
              <button
                className={`flex items-center rounded-md px-3 py-1.5 transition ${
                  toolsActive
                    ? "font-medium text-text"
                    : "text-text-muted hover:bg-white/[0.04] hover:text-text"
                }`}
              >
                AI Tools
                <ChevronDown />
              </button>
              <div className="pointer-events-none absolute left-0 top-full w-52 pt-1 opacity-0 transition-opacity duration-100 group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="rounded-lg border border-bg-border bg-bg-panel p-1 shadow-xl w-52">
                  {TOOL_GROUPS.map((group, gi) => (
                    <div key={group.heading}>
                      {gi > 0 && <div className="my-1 border-t border-bg-border" />}
                      <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                        {group.heading}
                      </p>
                      {group.items.map((item) => {
                        const locked =
                          item.minTier === "APEX"  ? user.tier !== "APEX" :
                          item.minTier === "ELITE" ? (user.tier === "FREE" || user.tier === "PRO") :
                          item.minTier === "PRO"   ? user.tier === "FREE" :
                          false;
                        return (
                          <DropdownLink key={item.key} href={item.href} active={active === item.key}>
                            <span className="flex w-full items-center justify-between gap-2">
                              {item.label}
                              <span className="flex items-center gap-1">
                                {item.badge && (
                                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-text-muted">
                                    {item.badge}
                                  </span>
                                )}
                                {locked && <Lock className="h-3 w-3 text-text-dim opacity-60" />}
                              </span>
                            </span>
                          </DropdownLink>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Community dropdown */}
            <div className="group relative">
              <button
                className={`flex items-center rounded-md px-3 py-1.5 transition ${
                  communityActive
                    ? "font-medium text-text"
                    : "text-text-muted hover:bg-white/[0.04] hover:text-text"
                }`}
              >
                Community
                <ChevronDown />
              </button>
              <div className="pointer-events-none absolute left-0 top-full w-48 pt-1 opacity-0 transition-opacity duration-100 group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="rounded-lg border border-bg-border bg-bg-panel p-1 shadow-xl">
                  {COMMUNITY.map((item) => (
                    <DropdownLink key={item.key} href={item.href} active={active === item.key}>
                      {item.label}
                    </DropdownLink>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* ── Right: icons + meta + account dropdown ── */}
        <div className="flex items-center gap-2 text-sm">

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
          <span className="hidden max-w-[160px] truncate text-text-muted md:inline">
            {displayName}
          </span>

          <span className="rounded-md border border-bg-border bg-bg-panel px-2 py-1 text-xs font-medium">
            {tierMeta.name}
          </span>

          {userIsOwner && (
            <Link
              href="/admin"
              className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-200 transition hover:bg-yellow-500/20"
            >
              Admin
            </Link>
          )}

          {/* Account dropdown */}
          <div className="group relative hidden sm:block">
            <button
              className={`flex items-center rounded-md px-3 py-1.5 text-sm transition ${
                accountActive
                  ? "font-medium text-text"
                  : "text-text-muted hover:bg-white/[0.04] hover:text-text"
              }`}
            >
              Account
              <ChevronDown />
            </button>
            <div className="pointer-events-none absolute right-0 top-full w-44 pt-1 opacity-0 transition-opacity duration-100 group-hover:pointer-events-auto group-hover:opacity-100">
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

          {/* Mobile sign out */}
          <form action={handleSignOut} className="sm:hidden">
            <button className="btn-ghost text-xs">Sign out</button>
          </form>
        </div>
      </div>

      {/* ── Mobile scroll row ── */}
      <div className="scrollbar-hide flex gap-1 overflow-x-auto border-t border-bg-border px-4 py-1.5 text-sm sm:hidden">
        {ALL_MOBILE.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className={
              active === it.key
                ? "shrink-0 rounded-md px-3 py-1.5 font-medium text-text"
                : "shrink-0 rounded-md px-3 py-1.5 text-text-muted hover:text-text"
            }
          >
            {it.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
