import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { DashboardNav } from "@/components/dashboard-nav";
import { TrendRadar } from "@/components/trend-radar";
import Link from "next/link";

export default async function TrendsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  // Parallel: user + watch terms
  const [user, terms] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.watchTerm.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!user) redirect("/login");

  const limit = TIER_LIMITS[user.tier].watchTerms;
  const limitDisplay = limit === Infinity ? "unlimited" : String(limit);

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="trends" />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Trend Radar</h1>
            <p className="mt-3 text-text-muted">
              Track topics across the web. Pull fresh signals on demand.
            </p>
          </div>
          {limit > 0 && (
            <span className="text-sm text-text-muted">
              {terms.length} / {limitDisplay} terms
            </span>
          )}
        </div>

        {limit === 0 ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <h3 className="font-semibold">Trend Radar is an Elite feature</h3>
            <p className="mt-1 text-sm text-text-muted">
              Track up to 10 topics on Elite, unlimited on Apex. Get fresh search results
              for what matters to you.
            </p>
            <Link href="/pricing" className="btn-primary mt-4 w-fit">Upgrade</Link>
          </div>
        ) : (
          <TrendRadar
            initialTerms={terms.map((t) => ({
              id: t.id,
              term: t.term,
              createdAt: t.createdAt.toISOString(),
            }))}
            limit={limit === Infinity ? -1 : limit}
          />
        )}
      </main>
    </div>
  );
}
