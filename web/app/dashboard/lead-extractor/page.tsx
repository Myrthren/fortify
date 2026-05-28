import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { LeadExtractorClient } from "@/components/lead-extractor-client";
import { LockedPage } from "@/components/locked-page";

const TIER_LIMITS: Record<string, { maxAccounts: number; braveSearch: boolean; deepSearch: boolean }> = {
  PRO:   { maxAccounts: 10, braveSearch: false, deepSearch: false },
  ELITE: { maxAccounts: 25, braveSearch: true,  deepSearch: false },
  APEX:  { maxAccounts: 50, braveSearch: true,  deepSearch: true  },
};

export default async function LeadExtractorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  const canAccess = user.tier !== "FREE";
  const tierConfig = TIER_LIMITS[user.tier] ?? TIER_LIMITS.PRO;

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="lead-extractor" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        {!canAccess ? (
          <LockedPage
            title="Lead Extractor"
            description="Paste TikTok and Instagram handles — Fortify researches each business and surfaces their email and phone number."
            requiredTier="PRO"
            icon="🔍"
            features={[
              "Bulk paste up to 50 accounts at once",
              "Scrapes bio, linked website, and runs web search",
              "Extracts verified emails and phone numbers",
              "Export results as CSV",
              "One-click to Outreach for any lead found",
            ]}
            user={user}
            active
          />
        ) : (
          <LeadExtractorClient
            userCredits={user.credits}
            tier={user.tier}
            maxAccounts={tierConfig.maxAccounts}
            braveSearch={tierConfig.braveSearch}
            deepSearch={tierConfig.deepSearch}
          />
        )}
      </main>
    </div>
  );
}
