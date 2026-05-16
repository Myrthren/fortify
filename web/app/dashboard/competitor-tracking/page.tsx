import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { CompetitorWatchClient } from "@/components/competitor-watch-client";
import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function CompetitorTrackingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  const canAccess = user.tier === "ELITE" || user.tier === "APEX";

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-bg">
        <DashboardNav user={user} active="competitor-watch" />
        <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-bg-border"
            style={{
              background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
              boxShadow:
                "0 0 40px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <Lock className="h-8 w-8 text-text-muted" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Competitor Watch</h1>
          <p className="text-text-muted mb-2 max-w-md mx-auto">
            Monitor competitor pages for changes and get notified when their content shifts — pricing, offers, messaging.
          </p>
          <p className="text-sm text-text-dim mb-6">
            Available on{" "}
            <span className="inline-flex items-center gap-1 font-medium text-text-muted">
              <span className="rounded-md bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-xs font-medium text-blue-300">
                Elite
              </span>
              and
              <span className="rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-xs font-medium text-purple-300">
                Apex
              </span>
            </span>{" "}
            plans.
          </p>
          <Link href="/pricing" className="btn-primary">
            <Sparkles className="h-4 w-4" />
            Upgrade to unlock Competitor Watch
          </Link>
        </main>
      </div>
    );
  }

  const watches = await db.competitorWatch.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      scans: {
        orderBy: { scannedAt: "desc" },
        take: 5,
      },
    },
  });

  const serialisedWatches = watches.map((w) => ({
    id: w.id,
    name: w.name,
    links: w.links as {
      id: string;
      url: string;
      label: string;
      type: string;
      lastHash?: string;
      lastScanAt?: string;
    }[],
    active: w.active,
    creditsPaid: w.creditsPaid,
    createdAt: w.createdAt.toISOString(),
    scans: w.scans.map((s) => ({
      id: s.id,
      url: s.url,
      hasChange: s.hasChange,
      summary: s.summary,
      scannedAt: s.scannedAt.toISOString(),
    })),
  }));

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="competitor-watch" />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <CompetitorWatchClient
          watches={serialisedWatches}
          userCredits={user.credits}
        />
      </main>
    </div>
  );
}
