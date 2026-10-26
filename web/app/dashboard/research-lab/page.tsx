import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { workspaceUserId } from "@/lib/workspace-request";
import { labAiEnabled } from "@/lib/research-institute-ai";
import { DashboardNav } from "@/components/dashboard-nav";
import { ResearchInstitute } from "@/components/research-institute";
import { SIMULATION_TUTORIAL_VERSION, simulationStorageKey, tutorialScope } from "@/lib/simulation-tutorial";
export default async function ResearchLabPage() {
  const id = await workspaceUserId(); if (!id) redirect("/login");
  const user = await db.user.findUnique({ where: { id } }); if (!user) redirect("/login");
  const business = user.tier === "FREE" ? null : await db.businessProfile.findFirst({ where: { userId: id, active: true }, select: { id: true, name: true } });
  const scope = tutorialScope(business?.id ?? null);
  const progress = await db.simulationTutorialProgress.findUnique({ where: { userId_scope: { userId: id, scope } }, select: { version: true } });
  const storageKey = simulationStorageKey(id, business?.id ?? null);
  return <div className="min-h-screen"><DashboardNav user={user} active="research-lab"/><main className="institute-page"><ResearchInstitute key={storageKey} storageKey={storageKey} aiAvailable={labAiEnabled()} tutorial={{ businessId: business?.id ?? null, businessName: business?.name ?? "Personal workspace", seen: (progress?.version ?? 0) >= SIMULATION_TUTORIAL_VERSION }}/></main></div>;
}
