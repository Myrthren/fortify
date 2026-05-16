import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ReconClient } from "@/components/recon-client";
import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function ReconPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  const canAccess = user.tier === "ELITE" || user.tier === "APEX";

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-bg">
        <DashboardNav user={user} active="recon" />
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
          <h1 className="text-3xl font-bold tracking-tight mb-3">Fortify Recon</h1>
          <p className="text-text-muted mb-2 max-w-md mx-auto">
            Find local businesses in any area and category — ready to prospect.
          </p>
          <p className="text-sm text-text-dim mb-8">
            Available on{" "}
            <span className="text-text-muted font-medium">Elite and Apex</span> plans.
          </p>
          <Link href="/pricing" className="btn-primary">
            <Sparkles className="h-4 w-4" />
            Upgrade to unlock Recon
          </Link>
        </main>
      </div>
    );
  }

  const pastSearches = await db.reconSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      location: true,
      category: true,
      totalLeads: true,
      createdAt: true,
    },
  });

  const serialisedSearches = pastSearches.map((s) => ({
    id: s.id,
    location: s.location,
    category: s.category,
    totalLeads: s.totalLeads,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="recon" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <ReconClient
          pastSearches={serialisedSearches}
          userCredits={user.credits}
        />
      </main>
    </div>
  );
}
