import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { AdsDashboard } from "@/components/ads-dashboard";
import { LockedPage } from "@/components/locked-page";
import { TIER_LIMITS } from "@/lib/tiers";
import { BarChart3, TrendingUp, Bot, Wallet } from "lucide-react";
import Link from "next/link";

export default async function AdsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const [user, metaConn] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.metaConnection.findUnique({ where: { userId } }),
  ]);
  if (!user) redirect("/login");

  if (!TIER_LIMITS[user.tier].metaAds) {
    return (
      <LockedPage
        title="Meta Ads Dashboard"
        description="Connect your Meta ad account and get AI-powered analysis of your campaigns, spend, and performance."
        requiredTier="PRO"
        icon={<BarChart3 />}
        user={user}
        active="ads"
        features={[
          { icon: <TrendingUp />, title: "Campaign performance", desc: "Impressions, clicks, CTR, and ROAS across all campaigns." },
          { icon: <Bot />, title: "AI analysis", desc: "Weekly AI digest of what's working and what to cut." },
          { icon: <Wallet />, title: "Spend tracking", desc: "Budget vs spend vs return — at a glance." },
        ]}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="ads" />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="anim-fade-up mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Business</span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Meta Ads</h1>
            <p className="mt-3 text-text-muted">
              Real campaign performance from your connected Meta ad account.
            </p>
          </div>
          {metaConn && (
            <Link
              href="/dashboard/settings"
              className="text-sm text-text-muted underline-offset-4 hover:underline"
            >
              Manage connection
            </Link>
          )}
        </div>

        <AdsDashboard connected={!!metaConn} />
      </main>
    </div>
  );
}
