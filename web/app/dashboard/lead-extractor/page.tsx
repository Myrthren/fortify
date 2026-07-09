import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { LeadExtractorClient } from "@/components/lead-extractor-client";
import { LockedPage } from "@/components/locked-page";
import { Search, ClipboardList, Globe, Contact } from "lucide-react";

const TIER_LIMITS: Record<string, { maxAccounts: number; braveSearch: boolean; deepScan: boolean; applyContext: boolean }> = {
  PRO:   { maxAccounts: 10, braveSearch: false, deepScan: false, applyContext: false },
  ELITE: { maxAccounts: 25, braveSearch: true,  deepScan: false, applyContext: true  },
  APEX:  { maxAccounts: 50, braveSearch: true,  deepScan: true,  applyContext: true  },
};

export default async function LeadExtractorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  if (user.tier === "FREE") {
    return (
      <LockedPage
        title="Lead Extractor"
        description="Paste TikTok and Instagram profile URLs — Fortify researches each business and surfaces their email and phone number."
        requiredTier="PRO"
        icon={<Search />}
        features={[
          { icon: <ClipboardList />, title: "Bulk paste", desc: "Process up to 50 accounts in one batch" },
          { icon: <Globe />, title: "Deep research", desc: "Bio, website, contact pages and web search" },
          { icon: <Contact />, title: "Contacts found", desc: "Emails and phone numbers, ready to export" },
        ]}
        user={user}
        active="lead-extractor"
      />
    );
  }

  const tierConfig = TIER_LIMITS[user.tier] ?? TIER_LIMITS.PRO;

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="lead-extractor" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <LeadExtractorClient
          userCredits={user.credits}
          tier={user.tier}
          maxAccounts={tierConfig.maxAccounts}
          braveSearch={tierConfig.braveSearch}
          deepScan={tierConfig.deepScan}
          applyContext={tierConfig.applyContext}
        />
      </main>
    </div>
  );
}
