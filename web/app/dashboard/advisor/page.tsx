import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { LockedPage } from "@/components/locked-page";
import { AdvisorClient } from "@/components/advisor-client";
import { Zap, Brain, Telescope, ClipboardList } from "lucide-react";

export default async function AdvisorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  // Apex only
  if (user.tier !== "APEX") {
    return (
      <LockedPage
        user={user}
        active="advisor"
        requiredTier="APEX"
        title="AI Advisor"
        description="Your dedicated AI strategic advisor. It reads all your Fortify data — Company DNA, competitors, trends, tool history, connected platforms — and gives you comprehensive, personalised strategic analysis using Claude Opus."
        icon={<Zap />}
        features={[
          { icon: <Brain />, title: "Claude Opus Intelligence", desc: "The most capable Claude model. Deeper reasoning, more thorough analysis, genuinely expert-level responses." },
          { icon: <Telescope />, title: "Full Context Synthesis", desc: "Reads your DNA, competitors, trend watch terms, tool usage patterns, and platform data before responding." },
          { icon: <ClipboardList />, title: "Saved Strategy Sessions", desc: "Every session is saved. Build a library of strategic decisions and track how your thinking evolves." },
        ]}
      />
    );
  }

  // Load past advisor sessions (sessions whose title starts with "Strategy:")
  const rawSessions = await db.chatSession.findMany({
    where: {
      userId,
      title: { startsWith: "Strategy:" },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, messages: true, createdAt: true },
  });

  const pastSessions = rawSessions.map((s) => ({
    id: s.id,
    title: s.title,
    messages: (s.messages as any[]).filter(
      (m) => m.role === "user" || m.role === "assistant"
    ),
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="advisor" />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AI Advisor</h1>
            <span className="rounded-md border border-bg-border bg-bg-panel px-2 py-0.5 text-xs font-medium text-text-muted">
              Apex
            </span>
          </div>
          <p className="mt-2 text-text-muted max-w-2xl">
            Your personal strategic advisor. Describe any challenge and it synthesises everything it knows about your business — using Claude Opus — into a comprehensive strategic brief.
          </p>
        </div>

        <AdvisorClient pastSessions={pastSessions} />
      </main>
    </div>
  );
}
