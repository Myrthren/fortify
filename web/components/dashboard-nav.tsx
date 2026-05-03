import Link from "next/link";
import { Logo } from "@/components/logo";
import { TIERS } from "@/lib/tiers";
import { isOwner } from "@/lib/owner";
import { handleSignOut } from "@/app/actions/auth";
import type { Tier } from "@prisma/client";

type ActiveKey =
  | "dashboard"
  | "voice"
  | "outreach"
  | "audit"
  | "trends"
  | "competitors"
  | "matchmaking"
  | "members"
  | "deals"
  | "pods"
  | "profile"
  | "settings"
  | "support";

const TOOLS = [
  { key: "voice",       href: "/dashboard/voice",       label: "Brand Voice" },
  { key: "outreach",    href: "/dashboard/outreach",    label: "Outreach" },
  { key: "audit",       href: "/dashboard/audit",       label: "Funnel Audit" },
  { key: "trends",      href: "/dashboard/trends",      label: "Trend Radar" },
  { key: "competitors", href: "/dashboard/competitors", label: "Competitors" },
  { key: "matchmaking", href: "/dashboard/matchmaking", label: "Matchmaking" },
] as const;

const COMMUNITY = [
  { key: "members", href: "/dashboard/members", label: "Members" },
  { key: "deals",   href: "/dashboard/deals",   label: "Deal Board" },
  { key: "pods",    href: "/dashboard/pods",    label: "Mastermind Pods" },
] as const;

const ACCOUNT = [
  { key: "profile",  href: "/dashboard/profile",  label: "Profile" },
  { key: "settings", href: "/dashboard/settings", label: "Settings" },
  { key: "support",  href: "/dashboard/support",  label: "Support" },
] as const;

const ALL_MOBILE = [
  { key: "dashboard",   href: "/dashboard",            label: "Dashboard" },
  ...TOOLS,
  ...COMMUNITY,
  ...ACCOUNT,
];

const TOOLS_KEYS      = TOOLS.map((t) => t.key);
const COMMUNITY_KEYS  = COMMUNITY.map((t) => t.key);
const ACCOUNT_KEYS    = ACCOUNT.map((t) => t.key);

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
  user: { email: string | null; tier: Tier; discordId: string | null };
  active: ActiveKey;
}) {
  const tierMeta      = TIERS[user.tier];
  const userIsOwner   = isOwner(user.discordId);
  const toolsActive   = TOOLS_KEYS.includes(active as any);
  const communityActive = COMMUNITY_KEYS.includes(active as any);
  const accountActive = ACCOUNT_KEYS.includes(active as any);

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
              <div className="pointer-events-none absolute left-0 top-full w-44 pt-1 opacity-0 transition-opacity duration-100 group-hover:pointer-events-auto group-hover:opacity-100">
                <div className="rounded-lg border border-bg-border bg-bg-panel p-1 shadow-xl">
                  {TOOLS.map((item) => (
                    <DropdownLink key={item.key} href={item.href} active={active === item.key}>
                      {item.label}
                    </DropdownLink>
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

        {/* ── Right: meta + account dropdown ── */}
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden max-w-[160px] truncate text-text-muted md:inline">
            {user.email}
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
                    {item.label}
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

          {/* Mobile sign out (fallback, only when Account dropdown is hidden) */}
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
