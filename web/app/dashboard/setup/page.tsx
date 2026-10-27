import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { workspaceUserId } from "@/lib/workspace-request";
import { BUSINESS_LIMITS } from "@/lib/business-setup";
import { WorkspaceMemberSync } from "@/components/workspace-member-sync";
import { BusinessSetup } from "@/components/business-setup";

export default async function BusinessSetupPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const id = await workspaceUserId();
  if (!id) redirect("/login");
  const user = await db.user.findUnique({
    where: { id },
    include: { businesses: { orderBy: [{ active: "desc" }, { updatedAt: "desc" }] } },
  });
  if (!user) redirect("/login");
  const limit = BUSINESS_LIMITS[user.tier];
  const startNew = (await searchParams).new === "1" && user.businesses.length < limit;
  const contextKey = user.businesses.find(business => business.active)?.id ?? "personal";
  return <div className="min-h-screen"><WorkspaceMemberSync user={user} active="setup"/><main className="business-setup-page"><BusinessSetup key={`${startNew ? "new" : "manage"}:${contextKey}`} startNew={startNew} tier={user.tier} limit={Number.isFinite(limit) ? limit : null} initialBusinesses={user.businesses.map(business => ({ ...business, website: business.website ?? "", channels: business.channels as string[], recommendations: business.recommendations as any[] }))}/></main></div>;
}
