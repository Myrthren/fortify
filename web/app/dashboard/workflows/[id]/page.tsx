import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { WorkflowEditor } from "@/components/workflow-editor";

export default async function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  const workflow = await db.workflow.findFirst({
    where: { id: params.id, userId },
    include: {
      runs: { orderBy: { startedAt: "desc" }, take: 20 },
    },
  });

  if (!workflow) notFound();

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="workflows" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <WorkflowEditor
          workflow={{
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            active: workflow.active,
            nodes: workflow.nodes as any[],
            runs: workflow.runs.map((r) => ({
              id: r.id,
              status: r.status,
              usedCapacity: r.usedCapacity,
              startedAt: r.startedAt.toISOString(),
              completedAt: r.completedAt?.toISOString() ?? null,
              log: r.log as any[],
            })),
          }}
        />
      </main>
    </div>
  );
}
