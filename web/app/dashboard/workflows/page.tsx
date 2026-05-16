import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { WorkflowsClient } from "@/components/workflows-client";
import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
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
      <div className="min-h-screen bg-bg">
        <DashboardNav user={user} active="workflows" />
        <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-bg-border"
            style={{
              background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
              boxShadow: "0 0 40px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <Lock className="h-8 w-8 text-text-muted" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Workflows</h1>
          <p className="text-text-muted mb-2 max-w-md mx-auto">
            Automate your business with multi-step AI workflows. Connect triggers, actions, and AI steps into powerful automations.
          </p>
          <p className="text-sm text-text-dim mb-8">
            Available on <span className="text-text-muted font-medium">Elite and Apex</span> plans.
          </p>
          <div className="mb-10 grid gap-3 sm:grid-cols-3 text-left max-w-xl mx-auto">
            {[
              { icon: "⚡", title: "Triggers", desc: "Start workflows on schedule, webhook, or from other Fortify features." },
              { icon: "🤖", title: "AI Steps", desc: "Chain AI actions — analyse, generate, summarise, and decide automatically." },
              { icon: "📤", title: "Actions", desc: "Post to Discord, send emails, update CRM, notify Slack, and more." },
            ].map((f) => (
              <div key={f.title} className="card p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{f.icon}</span>
                  <p className="text-sm font-semibold">{f.title}</p>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="btn-primary">
            <Sparkles className="h-4 w-4" />
            Upgrade to unlock Workflows
          </Link>
          <p className="mt-4 text-xs text-text-dim">Plans from £79/mo · Cancel anytime</p>
        </main>
      </div>
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
