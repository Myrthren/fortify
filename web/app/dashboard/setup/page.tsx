import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { workspaceUserId } from "@/lib/workspace-request";
import { BUSINESS_LIMITS } from "@/lib/business-setup";
import { DashboardNav } from "@/components/dashboard-nav";
import { BusinessSetup } from "@/components/business-setup";

export default async function BusinessSetupPage() {
  const id = await workspaceUserId();
  if (!id) redirect("/login");
  const user = await db.user.findUnique({
    where: { id },
    include: { businesses: { orderBy: [{ active: "desc" }, { updatedAt: "desc" }] } },
  });
  if (!user) redirect("/login");
  const limit = BUSINESS_LIMITS[user.tier];
  return <div className="min-h-screen"><DashboardNav user={user} active="setup"/><main className="business-setup-page"><BusinessSetup tier={user.tier} limit={Number.isFinite(limit) ? limit : null} initialBusinesses={user.businesses.map(business => ({ ...business, website: business.website ?? "", channels: business.channels as string[], recommendations: business.recommendations as any[] }))}/></main></div>;
}
