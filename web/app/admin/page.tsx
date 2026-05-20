import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { TIERS } from "@/lib/tiers";
import { Logo } from "@/components/logo";
import { TierSwitcher } from "@/components/tier-switcher";
import { AdminCreditAdjuster } from "@/components/admin-credit-adjuster";
import { AdminAnnouncementManager } from "@/components/admin-announcement-manager";
import { AdminResetLimits } from "@/components/admin-reset-limits";
import Link from "next/link";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
  });
  if (!user) redirect("/login");
  if (!isOwner(user.discordId)) redirect("/dashboard");

  const tierMeta = TIERS[user.tier];

  const announcements = await db.announcement.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, message: true, expiresAt: true },
  });

  const allUsers = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      discordId: true,
      tier: true,
      credits: true,
      createdAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bg-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Logo withWord />
            <span className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-200">
              Admin
            </span>
          </div>
          <Link href="/dashboard" className="text-sm text-text-muted hover:text-text">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-6 py-12">

        {/* Quick links */}
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/bans" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20 transition">
            🔨 Ban Manager
          </Link>
          <Link href="/admin/moderation" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition">
            🚩 Forum Moderation
          </Link>
          <Link href="/admin/usage" className="rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-sm font-medium text-purple-300 hover:bg-purple-500/20 transition">
            📊 Usage &amp; Abuse
          </Link>
          <Link href="/admin/pods" className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 transition">
            🫂 Mastermind Pods
          </Link>
        </div>

        {/* Reset limits */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Dev tools</h2>
          <p className="mt-1 text-sm text-text-muted">
            Reset your own account limits for testing. Deletes AI sessions, recent generations, restores credits.
          </p>
          <div className="mt-4">
            <AdminResetLimits userId={user.id} />
          </div>
        </section>

        {/* Tier switcher */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Your tier</h2>
          <p className="mt-1 text-sm text-text-muted">
            Currently on <span className="text-text">{tierMeta.name}</span>. Switch
            for testing — no PayPal subscription is created.
          </p>
          <div className="mt-4">
            <TierSwitcher current={user.tier} />
          </div>
        </section>

        {/* Announcements */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Announcements</h2>
          <p className="mt-1 text-sm text-text-muted">
            Active announcements show in a bar at the top of every dashboard page. Multiple messages cycle every 10 seconds.
          </p>
          <div className="card mt-4 p-5">
            <AdminAnnouncementManager
              initial={announcements.map((a) => ({
                id: a.id,
                message: a.message,
                expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
              }))}
            />
          </div>
        </section>

        {/* Credit adjuster */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Adjust credits</h2>
          <p className="mt-1 text-sm text-text-muted">
            Add or deduct credits from any account. Logged as an admin transaction.
          </p>
          <div className="card mt-4 p-5">
            <AdminCreditAdjuster
              users={allUsers.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                credits: u.credits,
              }))}
            />
          </div>
        </section>

        {/* Users table */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Recent users</h2>
          <p className="mt-1 text-sm text-text-muted">Last 50 by created date.</p>
          <div className="card mt-4 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-bg-border bg-black/20">
                <tr>
                  <th className="px-4 py-2 font-medium text-text-muted">Name</th>
                  <th className="px-4 py-2 font-medium text-text-muted">Email</th>
                  <th className="px-4 py-2 font-medium text-text-muted">Tier</th>
                  <th className="px-4 py-2 font-medium text-text-muted tabular-nums">Credits</th>
                  <th className="px-4 py-2 font-medium text-text-muted">Joined</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id} className="border-b border-bg-border/50 last:border-0">
                    <td className="px-4 py-2">{u.name ?? "—"}</td>
                    <td className="px-4 py-2 text-text-muted">{u.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className="rounded border border-bg-border bg-black/20 px-1.5 py-0.5 text-xs">
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-text-muted">
                      {u.credits.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-text-muted">
                      {u.createdAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
