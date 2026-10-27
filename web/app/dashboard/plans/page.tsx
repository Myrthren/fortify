import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { workspaceUserId } from "@/lib/workspace-request";
import { WorkspaceMemberSync } from "@/components/workspace-member-sync";
import { PlansLibrary } from "@/components/plans-library";
export default async function PlansPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const userId = await workspaceUserId(); if (!userId) redirect("/login");
  const archived = (await searchParams).archived === "true";
  const [user, plans] = await Promise.all([db.user.findUnique({ where: { id: userId } }), db.futurePlan.findMany({ where: { userId, archived }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, description: true, version: true, cardCount: true, doneCount: true, archived: true, updatedAt: true } })]);
  if (!user) redirect("/login");
  return <div className="min-h-screen"><WorkspaceMemberSync user={user} active="plans"/><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><PlansLibrary key={String(archived)} initial={plans.map(plan => ({ ...plan, updatedAt: plan.updatedAt.toISOString() }))} archived={archived}/></main></div>;
}
