import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getWorkspaceSnapshot } from "@/lib/workspace-activity";
import { DashboardNav } from "@/components/dashboard-nav";
import { DashboardHome } from "@/components/dashboard-home";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;
  if (typeof userId !== "string" || !userId) redirect("/login");
  const [user, snapshot] = await Promise.all([db.user.findUnique({ where: { id: userId }, include: { _count: { select: { businesses: true } } } }), getWorkspaceSnapshot(userId)]);
  if (!user) redirect("/login");
  return <div className="relative min-h-screen"><DashboardNav user={user} active="dashboard"/><DashboardHome name={user.name?.split(" ")[0] ?? "operator"} tier={user.tier} credits={user.credits} snapshot={snapshot} hasBusiness={user._count.businesses > 0}/></div>;
}
