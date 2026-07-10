import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { DashboardNav } from "@/components/dashboard-nav";
import { LeadSourcer } from "@/components/lead-sourcer";
import Link from "next/link";

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  const canAccess = TIER_LIMITS[user.tier].leadSourcing;

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="leads" />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 anim-fade-up">
          <span className="eyebrow">Growth</span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Lead Sourcing</h1>
          <p className="mt-3 text-text-muted">
            Describe your ideal customer. Fortify searches the web and scores each match against your ICP — with a personalized outreach hook for every lead.
          </p>
        </div>

        {!canAccess ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <h3 className="font-semibold">Lead Sourcing is a Pro+ feature</h3>
            <p className="mt-1 text-sm text-text-muted">
              Describe your ideal customer profile and get a scored list of prospects ready for outreach.
            </p>
            <Link href="/pricing" className="btn-primary mt-4 w-fit">Upgrade to Pro</Link>
          </div>
        ) : (
          <LeadSourcer />
        )}
      </main>
    </div>
  );
}
