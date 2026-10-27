import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { workspaceUserId } from "@/lib/workspace-request";
import { getPlanView, getPlanBindings } from "@/lib/plan-storage";
import { WorkspaceMemberSync } from "@/components/workspace-member-sync";
import { PlanningCanvas } from "@/components/planning-canvas";
export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await workspaceUserId(); if (!userId) redirect("/login");
  const { id } = await params;
  const [user, plan, bindings] = await Promise.all([db.user.findUnique({ where: { id: userId } }), getPlanView(userId, id), getPlanBindings(userId)]);
  if (!user) redirect("/login"); if (!plan) notFound();
  return <div className="min-h-screen"><WorkspaceMemberSync user={user} active="plans"/><main className="plan-editor-page"><PlanningCanvas initial={plan} bindings={bindings}/></main></div>;
}
