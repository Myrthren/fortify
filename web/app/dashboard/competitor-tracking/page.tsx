import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { CompetitorWatchClient } from "@/components/competitor-watch-client";
import { LockedPage } from "@/components/locked-page";
import { Eye, RefreshCw, Bell, History } from "lucide-react";

export default async function CompetitorTrackingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  const canAccess = user.tier === "ELITE" || user.tier === "APEX";

  if (!canAccess) {
    return (
      <LockedPage
        user={user} active="competitor-watch" requiredTier="ELITE"
        title="Competitor Watch"
        description="Monitor competitor pages for content changes. Get notified via Discord DM and dashboard when their pricing, offers, or messaging shifts."
        icon={<Eye />}
        features={[
          { icon: <RefreshCw />, title: "Automatic Scanning", desc: "Daily scans compare readable page wording and show added and removed text." },
          { icon: <Bell />, title: "Daily Change Alerts", desc: "Dashboard notifications and Discord DMs after a daily scan detects changed wording." },
          { icon: <History />, title: "Change History", desc: "Recent scans show when wording changed and excerpts of what was added or removed." },
        ]}
      />
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
    <div className="min-h-screen">
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
