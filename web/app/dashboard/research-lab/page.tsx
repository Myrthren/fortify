import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { workspaceUserId } from "@/lib/workspace-request";
import { labAiEnabled } from "@/lib/research-institute-ai";
import { DashboardNav } from "@/components/dashboard-nav";
import { ResearchInstitute } from "@/components/research-institute";
export default async function ResearchLabPage() {
  const id = await workspaceUserId(); if (!id) redirect("/login");
  const user = await db.user.findUnique({ where: { id } }); if (!user) redirect("/login");
  return <div className="min-h-screen"><DashboardNav user={user} active="research-lab"/><main className="institute-page"><ResearchInstitute key={id} storageKey={`fortify-institute-v1:${id}`} aiAvailable={labAiEnabled()}/></main></div>;
}
