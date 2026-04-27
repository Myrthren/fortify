import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { DashboardNav } from "@/components/dashboard-nav";
import { CompetitorScanner } from "@/components/competitor-scanner";
import Link from "next/link";

export default async function CompetitorsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const [user, competitors] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.competitor.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!user) redirect("/login");

  const limit = TIER_LIMITS[user.tier].competitors;
  const limitDisplay = limit === Infinity ? "unlimited" : String(limit);

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="competitors" />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Competitor Scanner</h1>
            <p className="mt-3 text-text-muted">
              Track competitors. On-demand scans pull their site + recent news + give you intel
              you can act on.
            </p>
          </div>
          {limit > 0 && (
            <span className="text-sm text-text-muted">
              {competitors.length} / {limitDisplay} tracked
            </span>
          )}
        </div>

        {limit === 0 ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <h3 className="font-semibold">Competitor Scanner is a Pro+ feature</h3>
            <p className="mt-1 text-sm text-text-muted">
              Track up to 3 competitors on Pro, 10 on Elite, unlimited on Apex.
            </p>
            <Link href="/pricing" className="btn-primary mt-4 w-fit">Upgrade</Link>
          </div>
        ) : (
          <CompetitorScanner
            initial={competitors.map((c) => ({
              id: c.id,
              name: c.name,
              url: c.url,
              lastReport: c.lastReport as any,
              lastScanned: c.lastScanned ? c.lastScanned.toISOString() : null,
              createdAt: c.createdAt.toISOString(),
            }))}
            limit={limit === Infinity ? -1 : limit}
          />
        )}
      </main>
    </div>
  );
}
