import Link from "next/link";
import { Logo } from "@/components/logo";
import { TIERS } from "@/lib/tiers";
import { isOwner } from "@/lib/owner";
import { signOut } from "@/auth";
import type { Tier } from "@prisma/client";

const NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  { key: "voice", href: "/dashboard/voice", label: "Brand Voice" },
  { key: "outreach", href: "/dashboard/outreach", label: "Outreach" },
  { key: "audit", href: "/dashboard/audit", label: "Funnel Audit" },
  { key: "trends", href: "/dashboard/trends", label: "Trend Radar" },
  { key: "members", href: "/dashboard/members", label: "Members" },
  { key: "matchmaking", href: "/dashboard/matchmaking", label: "Matchmaking" },
  { key: "profile", href: "/dashboard/profile", label: "Profile" },
] as const;

export function DashboardNav({
  user,
  active,
}: {
  user: { email: string | null; tier: Tier; discordId: string | null };
  active: "dashboard" | "voice" | "outreach" | "audit" | "members" | "profile" | "trends" | "matchmaking";
}) {
  const tierMeta = TIERS[user.tier];

  return (
    <header className="sticky top-0 z-40 border-b border-bg-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo withWord />
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {NAV_ITEMS.map((it) => (
              <Link
                key={it.key}
                href={it.href}
                className={
                  active === it.key
                    ? "rounded-md px-3 py-1.5 font-medium text-text"
                    : "rounded-md px-3 py-1.5 text-text-muted transition hover:bg-white/[0.04] hover:text-text"
                }
              >
                {it.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="hidden max-w-[180px] truncate text-text-muted md:inline">
            {user.email}
          </span>
          <span className="rounded-md border border-bg-border bg-bg-panel px-2 py-1 text-xs font-medium">
            {tierMeta.name}
          </span>
          {isOwner(user.discordId) && (
            <Link
              href="/admin"
              className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-200 transition hover:bg-yellow-500/20"
            >
              Admin
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="btn-ghost text-xs">Sign out</button>
          </form>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="scrollbar-hide flex gap-1 overflow-x-auto border-t border-bg-border px-4 py-1.5 text-sm sm:hidden">
        {NAV_ITEMS.map((it) => (
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
