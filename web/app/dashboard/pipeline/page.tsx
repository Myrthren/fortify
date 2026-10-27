import { redirect } from "next/navigation";
import { dashboardSession as auth } from "@/lib/session-user";
import { db } from "@/lib/db";
import { WorkspaceMemberSync } from "@/components/workspace-member-sync";
import { PipelineClient } from "@/components/pipeline-client";
import { pipelineWhere } from "@/lib/pipeline-query";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ lead?: string; view?: string }> }) {
  const session = await auth(); const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const params = await searchParams;
  const view = ["open", "due"].includes(params.view ?? "") ? params.view! : "all";
  const [user, rows, selected, stages] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.leadStatus.findMany({ where: pipelineWhere(userId, { view }), orderBy: { id: "desc" }, take: 101 }),
    params.lead ? db.leadStatus.findFirst({ where: { id: params.lead, userId } }) : null,
    db.leadStatus.groupBy({ by: ["status"], where: { userId }, _count: true }),
  ]);
  if (!user) redirect("/login");
  const page = rows.slice(0, 100), nextCursor = rows.length > 100 ? page[page.length - 1].id : null;
  const leads = selected && !page.some(item => item.id === selected.id) ? [selected, ...page] : page;
  return <div className="min-h-screen"><WorkspaceMemberSync user={user} active="pipeline"/><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><PipelineClient initialLeads={leads.map(item => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), followUpAt: item.followUpAt?.toISOString() ?? null }))} selectedId={selected?.id} initialView={view} nextCursor={nextCursor} initialCounts={Object.fromEntries(stages.map(item => [item.status, item._count]))}/></main></div>;
}
