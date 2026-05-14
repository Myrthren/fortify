import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ViralityEngine } from "@/components/virality-engine";
import { TIER_LIMITS } from "@/lib/tiers";
import Link from "next/link";

export default async function ViralityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const [user, socialConnections] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.socialConnection.findMany({ where: { userId } }),
  ]);

  if (!user) redirect("/login");

  const canUse = TIER_LIMITS[user.tier].virality;
  const canAutoPublish = TIER_LIMITS[user.tier].autoPublish;

  if (!canUse) {
    return (
      <div className="min-h-screen bg-bg">
        <DashboardNav user={user} active="virality" />
        <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6 text-center">
          <div className="mb-6 text-4xl">🎬</div>
          <h1 className="text-2xl font-bold tracking-tight mb-3">Virality Engine</h1>
          <p className="text-text-muted mb-8">
            Connect your social accounts, analyse your videos with AI, and publish at the perfect
            time with the perfect tags. Available on <strong>Elite</strong> and{" "}
            <strong>Apex</strong>.
          </p>
          <Link href="/pricing" className="btn-primary">
            Upgrade to Elite →
          </Link>
        </main>
      </div>
    );
  }

  const connections = socialConnections.map((c) => ({
    id: c.id,
    platform: c.platform,
    handle: c.handle,
    pageId: c.pageId,
  }));

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="virality" />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Virality Engine</h1>
            {canAutoPublish ? (
              <span className="rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-xs font-medium text-purple-300">
                Apex
              </span>
            ) : (
              <span className="rounded-md bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-xs font-medium text-blue-300">
                Elite
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted">
            Upload videos to your Media Pool, get AI virality scores per platform, and{" "}
            {canAutoPublish
              ? "auto-publish at the optimal time."
              : "publish manually with AI-optimised tags and titles."}
          </p>
        </div>

        <ViralityEngine
          initialConnections={connections}
          canAutoPublish={canAutoPublish}
        />
      </main>
    </div>
  );
}
