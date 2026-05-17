import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { WorkflowsClient } from "@/components/workflows-client";
import { LockedPage } from "@/components/locked-page";
import { getCapacityInfo, CAPACITY_PACKS } from "@/lib/workflow-capacity";

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  // Only Elite + Apex can access
  if (user.tier === "FREE" || user.tier === "PRO") {
    return (
      <LockedPage
        user={user} active="workflows" requiredTier="ELITE"
        title="Workflows"
        description="Build multi-step automations with a visual drag-and-drop canvas. Connect triggers, AI nodes, and actions into powerful pipelines."
        icon="⚡"
        features={[
          { icon: "🎯", title: "Smart Triggers", desc: "Schedule, webhooks, new members, competitor changes, and more." },
          { icon: "🤖", title: "AI Steps", desc: "Chain AI generate, summarise, analyse, and classify into any workflow." },
          { icon: "📤", title: "Actions", desc: "Post to Discord, email, Slack, Notion, Twitter, Shopify, or any webhook." },
        ]}
      />
    );
  }

  // Load capacity info and workflows
  const capacity = await getCapacityInfo(userId, user.tier);
  const workflows = await db.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { runs: true } },
      runs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  // We pass ONLY the display-safe capacity data (no formula details) to client
  const capacityDisplay = {
    used: capacity.used,
    total: capacity.isUnlimited ? null : capacity.total,
    remaining: capacity.isUnlimited ? null : capacity.remaining,
    pct: capacity.isUnlimited ? 0 : capacity.pct,
    isUnlimited: capacity.isUnlimited,
  };

  const packs = CAPACITY_PACKS.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    price: p.price,
  }));

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="workflows" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Workflows</h1>
          <p className="text-text-muted">
            Automate repetitive tasks with multi-step AI-powered workflows.
          </p>
        </div>
        <WorkflowsClient
          capacity={capacityDisplay}
          packs={packs}
          workflows={workflows.map((w) => ({
            id: w.id,
            name: w.name,
            description: w.description,
            active: w.active,
            runCount: w._count.runs,
            lastRunAt: w.runs[0]?.startedAt?.toISOString() ?? null,
            lastRunStatus: (w.runs[0] as any)?.status ?? null,
          }))}
          tier={user.tier}
        />
      </main>
    </div>
  );
}
