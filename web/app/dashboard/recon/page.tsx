import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ReconClient } from "@/components/recon-client";
import { LockedPage } from "@/components/locked-page";

export default async function ReconPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  const canAccess = user.tier === "ELITE" || user.tier === "APEX";

  if (!canAccess) {
    return (
      <LockedPage
        user={user} active="recon" requiredTier="ELITE"
        title="Fortify Recon"
        description="Find local businesses in any area and category — name, address, phone, and website. Ready to prospect."
        icon="🔍"
        features={[
          { icon: "📍", title: "Local Search", desc: "Search by location and business category anywhere in the world." },
          { icon: "📋", title: "Rich Data", desc: "Get name, address, phone number, website, and Google rating." },
          { icon: "🎯", title: "B2B Prospecting", desc: "Export leads and add them directly to your outreach pipeline." },
        ]}
      />
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
