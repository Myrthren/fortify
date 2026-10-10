import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { checkMonthly } from "@/lib/usage";
import { DashboardNav } from "@/components/dashboard-nav";
import { OutreachGenerator } from "@/components/outreach-generator";
import Link from "next/link";

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ prospect?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;
  const params = await searchParams;
  const initialProspect = params.prospect ?? "";

  const [user, voices] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.brandVoice.findMany({
      where: { userId },
      select: { id: true, name: true, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!user) redirect("/login");

  const limit = TIER_LIMITS[user.tier].monthlyOutreach;
  const { used } = await checkMonthly(userId, "outreach", limit);
  const limitDisplay = limit === Infinity ? "unlimited" : String(limit);

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="outreach" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="anim-fade-up">
            <span className="eyebrow">Growth</span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Cold Outreach</h1>
            <p className="mt-3 text-text-muted">
              Personalised messages that actually get replies. Uses your active brand voice when set.
            </p>
          </div>
          <span className="text-sm text-text-muted">
            {limit === Infinity ? "Unlimited" : `${used} / ${limitDisplay} this month`}
          </span>
        </div>

        {user.tier === "FREE" && (
          <div className="mb-6 rounded-lg border border-white/[0.07] bg-bg-panel px-4 py-3 text-sm text-text-muted">
            You&apos;re on the free plan — {limitDisplay} messages a month.{" "}
            <Link href="/pricing" className="underline hover:text-text">Pro gets 50, Elite and Apex unlimited.</Link>
          </div>
        )}
        <div className="card p-5 sm:p-6">
          <OutreachGenerator voices={voices} initialProspect={initialProspect} />
        </div>
      </main>
    </div>
  );
}
