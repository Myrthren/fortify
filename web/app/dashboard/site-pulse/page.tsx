import { redirect } from "next/navigation";
import { dashboardSession as auth } from "@/lib/session-user";
import { db } from "@/lib/db";
import { WorkspaceMemberSync } from "@/components/workspace-member-sync";
import { SitePulseClient } from "@/components/site-pulse-client";

export default async function SitePulsePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const [user, business, pulse] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.businessProfile.findFirst({ where: { userId, active: true }, select: { name: true, website: true } }),
    db.sitePulse.findFirst({ where: { userId }, orderBy: { checkedAt: "desc" } }),
  ]);
  if (!user) redirect("/login");
  return <div className="min-h-screen"><WorkspaceMemberSync user={user} active="site-pulse"/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12"><SitePulseClient business={business} initial={pulse ? { ...pulse, checkedAt: pulse.checkedAt.toISOString(), findings: pulse.findings as any[] } : null}/></main></div>;
}
