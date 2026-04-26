import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { checkMonthly } from "@/lib/usage";
import { DashboardNav } from "@/components/dashboard-nav";
import { FunnelAuditor } from "@/components/funnel-auditor";
import Link from "next/link";

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
  });
  if (!user) redirect("/login");

  const limit = TIER_LIMITS[user.tier].monthlyAudits;
  const { used } = await checkMonthly(user.id, "audit", limit);
  const limitDisplay = limit === Infinity ? "unlimited" : String(limit);

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="audit" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Funnel Auditor</h1>
            <p className="mt-3 text-text-muted">
              Paste a URL. Get scored + actionable fixes for clarity, hook, value prop, CTA, and friction.
            </p>
          </div>
          <span className="text-sm text-text-muted">
            {limit === Infinity ? "Unlimited" : `${used} / ${limitDisplay} this month`}
          </span>
        </div>

        {user.tier === "FREE" ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <h3 className="font-semibold">Funnel Auditor is a Pro feature</h3>
            <p className="mt-1 text-sm text-text-muted">
              Get 5 audits a month on Pro, unlimited on Elite+.
            </p>
            <Link href="/pricing" className="btn-primary mt-4 w-fit">Upgrade to Pro</Link>
          </div>
        ) : (
          <div className="card p-5 sm:p-6">
            <FunnelAuditor />
          </div>
        )}
      </main>
    </div>
  );
}
