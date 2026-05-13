import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { AdsDashboard } from "@/components/ads-dashboard";
import Link from "next/link";

export default async function AdsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const [user, metaConn] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.metaConnection.findUnique({ where: { userId } }),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="ads" />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Meta Ads</h1>
            <p className="mt-3 text-text-muted">
              Real campaign performance from your connected Meta ad account.
            </p>
          </div>
          {metaConn && (
            <Link
              href="/dashboard/settings"
              className="text-sm text-text-muted underline-offset-4 hover:underline"
            >
              Manage connection
            </Link>
          )}
        </div>

        <AdsDashboard connected={!!metaConn} />
      </main>
    </div>
  );
}
