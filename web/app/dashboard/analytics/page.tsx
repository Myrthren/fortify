import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { Suspense } from "react";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const [user, googleConn] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.googleConnection.findUnique({ where: { userId } }),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="analytics" />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 anim-fade-up">
          <span className="eyebrow">Business</span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Analytics</h1>
          <p className="mt-3 text-text-muted">
            Google Analytics 4, Search Console, and YouTube — all in one place.
          </p>
        </div>

        <Suspense>
          <AnalyticsDashboard
            conn={{
              connected: !!googleConn,
              gaPropertyId: googleConn?.gaPropertyId ?? null,
              gaPropertyName: googleConn?.gaPropertyName ?? null,
              scSiteUrl: googleConn?.scSiteUrl ?? null,
            }}
          />
        </Suspense>
      </main>
    </div>
  );
}
