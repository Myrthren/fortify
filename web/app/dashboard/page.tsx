import { redirect } from "next/navigation";
import { dashboardSession as auth } from "@/lib/session-user";
import { db } from "@/lib/db";
import { getWorkspaceSnapshot } from "@/lib/workspace-activity";
import { WorkspaceMemberSync } from "@/components/workspace-member-sync";
import { DashboardHome } from "@/components/dashboard-home";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;
  if (typeof userId !== "string" || !userId) redirect("/login");
  const user = await db.user.findUnique({ where: { id: userId }, include: { _count: { select: { businesses: true } } } });
  if (!user) redirect("/login");
  const snapshot = getWorkspaceSnapshot(userId);
  return <div className="relative min-h-screen"><WorkspaceMemberSync user={user} active="dashboard"/><DashboardHome name={user.name?.split(" ")[0] ?? "operator"} tier={user.tier} credits={user.credits} snapshot={snapshot} hasBusiness={user._count.businesses > 0}/></div>;
}
