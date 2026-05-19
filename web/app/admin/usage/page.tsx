export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default async function AdminUsagePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
  });
  if (!user) redirect("/login");
  if (!isOwner(user.discordId)) redirect("/dashboard");

  // ── Top AI spenders ───────────────────────────────────────────────────────────
  // Aggregate total AI spend per user across all their sessions
  const aiSessions = await db.aiSession.groupBy({
    by: ["userId"],
    _sum: { usedCostGbp: true },
    orderBy: { _sum: { usedCostGbp: "desc" } },
    take: 30,
  });

  const aiUserIds = aiSessions.map((s) => s.userId);
  const aiUsers = await db.user.findMany({
    where: { id: { in: aiUserIds } },
    select: { id: true, email: true, username: true, tier: true, discordId: true },
  });
  const aiUserMap = Object.fromEntries(aiUsers.map((u) => [u.id, u]));

  const topAiSpenders = aiSessions.map((s) => ({
    userId: s.userId,
    user: aiUserMap[s.userId] ?? null,
    totalCostGbp: s._sum.usedCostGbp ?? 0,
  }));

  // ── Revenue in (subscriptions paid this month) ────────────────────────────────
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const activeSubs = await db.subscription.findMany({
    where: { status: "ACTIVE" },
    select: { tier: true },
  });
  const tierPrices: Record<string, number> = { PRO: 29, ELITE: 79, APEX: 199 };
  const monthlyRevenue = activeSubs.reduce((sum, s) => sum + (tierPrices[s.tier] ?? 0), 0);

  // ── Total AI cost (all time) ──────────────────────────────────────────────────
  const totalAiCostRow = await db.aiSession.aggregate({ _sum: { usedCostGbp: true } });
  const totalAiCost = totalAiCostRow._sum.usedCostGbp ?? 0;

  // ── Total credit purchases (all time) ─────────────────────────────────────────
  const creditRevRow = await db.creditTransaction.aggregate({
    where: { amount: { gt: 0 } },
    _sum: { amount: true },
  });
  const totalCreditsRevenue = (creditRevRow._sum.amount ?? 0); // in credits, not £

  // ── Abuse alerts ──────────────────────────────────────────────────────────────
  const abuseAlerts = await db.abuseAlert.findMany({
    where: { dismissed: false },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      user: { select: { email: true, username: true, tier: true } },
    },
  });

  // ── Tier breakdown ────────────────────────────────────────────────────────────
  const tierCounts = await db.user.groupBy({
    by: ["tier"],
    _count: { _all: true },
  });
  const tierMap = Object.fromEntries(tierCounts.map((t) => [t.tier, t._count._all]));

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
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm text-text-muted hover:text-text">
              ← Admin
            </Link>
            <Link href="/dashboard" className="text-sm text-text-muted hover:text-text">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage &amp; Abuse</h1>
          <p className="mt-1 text-text-muted text-sm">
            Monitor AI costs, revenue, and user abuse patterns.
          </p>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Monthly Revenue", value: `£${monthlyRevenue.toLocaleString()}`, sub: "active subs" },
            { label: "All-time AI Cost", value: `£${totalAiCost.toFixed(2)}`, sub: "across all users" },
            { label: "Open Abuse Alerts", value: abuseAlerts.length, sub: "not dismissed" },
            { label: "Total Users", value: Object.values(tierMap).reduce((a, b) => a + b, 0), sub: `${tierMap.FREE ?? 0} free · ${(tierMap.PRO ?? 0) + (tierMap.ELITE ?? 0) + (tierMap.APEX ?? 0)} paid` },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-white/[0.07] p-4"
              style={{ background: "linear-gradient(145deg,#141414,#0d0d0d)" }}
            >
              <p className="text-xs text-text-muted">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
              <p className="text-xs text-text-dim">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Tier Breakdown ── */}
        <section>
          <h2 className="mb-3 text-base font-semibold">Users by Tier</h2>
          <div className="flex flex-wrap gap-3">
            {(["FREE", "PRO", "ELITE", "APEX"] as const).map((tier) => (
              <div key={tier} className="rounded-lg border border-bg-border bg-bg-panel px-4 py-2.5 text-sm">
                <span className="text-text-muted">{tier}</span>
                <span className="ml-2 font-semibold tabular-nums">{tierMap[tier] ?? 0}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Abuse Alerts ── */}
        <section>
          <h2 className="mb-4 text-base font-semibold">
            Abuse Alerts
            {abuseAlerts.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                {abuseAlerts.length}
              </span>
            )}
          </h2>

          {abuseAlerts.length === 0 ? (
            <p className="text-sm text-text-muted">No open alerts.</p>
          ) : (
            <div
              className="overflow-hidden rounded-xl border border-white/[0.07]"
              style={{ background: "linear-gradient(145deg,#141414,#0d0d0d)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] text-left text-xs text-text-muted">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Feature</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Alerts</th>
                    <th className="px-4 py-3 text-right">Last</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {abuseAlerts.map((a) => (
                    <tr key={a.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.user?.username ?? a.user?.email ?? a.userId}</p>
                        <p className="text-[11px] text-text-dim">{a.user?.tier}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[11px]">
                          {a.feature}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted max-w-[220px] truncate">{a.description}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        <span className={a.alertCount >= 10 ? "text-red-400" : a.alertCount >= 5 ? "text-amber-400" : ""}>
                          ×{a.alertCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-dim text-xs">
                        {new Date(a.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Top AI Spenders ── */}
        <section>
          <h2 className="mb-4 text-base font-semibold">Top AI Spenders (All Time)</h2>
          {topAiSpenders.length === 0 ? (
            <p className="text-sm text-text-muted">No AI usage yet.</p>
          ) : (
            <div
              className="overflow-hidden rounded-xl border border-white/[0.07]"
              style={{ background: "linear-gradient(145deg,#141414,#0d0d0d)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] text-left text-xs text-text-muted">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3 text-right">Total AI Cost</th>
                    <th className="px-4 py-3 text-right">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {topAiSpenders.map((s, i) => (
                    <tr key={s.userId} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 text-text-dim">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.user?.username ?? s.user?.email ?? s.userId}</p>
                        {s.user?.discordId && (
                          <p className="text-[11px] text-text-dim">Discord: {s.user.discordId}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{s.user?.tier ?? "?"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        <span className={s.totalCostGbp > 5 ? "text-red-400" : s.totalCostGbp > 1 ? "text-amber-400" : ""}>
                          £{s.totalCostGbp.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/usage/user/${s.userId}`}
                          className="text-xs text-text-muted underline hover:text-text"
                        >
                          View logs
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
