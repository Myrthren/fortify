import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { DashboardNav } from "@/components/dashboard-nav";
import { ContentInspiration } from "@/components/content-inspiration";
import Link from "next/link";

export default async function InspirationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const [user, profile] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.profile.findUnique({ where: { userId } }),
  ]);
  if (!user) redirect("/login");

  const canAccess = TIER_LIMITS[user.tier].contentInspiration;
  const defaultNiche = profile?.niche ?? "";

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="inspiration" />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Content Inspiration</h1>
          <p className="mt-3 text-text-muted">
            Mine Reddit and YouTube to find what content is actually resonating in your niche.
          </p>
        </div>

        {!canAccess ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <h3 className="font-semibold">Content Inspiration is a Pro+ feature</h3>
            <p className="mt-1 text-sm text-text-muted">
              Pro gets Reddit Top Posts. Elite unlocks YouTube Comment Intel too.
            </p>
            <Link href="/pricing" className="btn-primary mt-4 w-fit">Upgrade</Link>
          </div>
        ) : (
          <ContentInspiration defaultNiche={defaultNiche} tier={user.tier} />
        )}
      </main>
    </div>
  );
}
