import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ShopifyDashboard } from "@/components/shopify-dashboard";
import Link from "next/link";

export default async function ShopifyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const [user, shopifyConn] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.shopifyConnection.findUnique({ where: { userId } }),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="shopify" />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="anim-fade-up mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Business</span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Shopify</h1>
            <p className="mt-3 text-text-muted">Revenue, orders, and product performance from your store.</p>
          </div>
          {shopifyConn && (
            <Link href="/dashboard/settings" className="text-sm text-text-muted underline-offset-4 hover:underline">
              Manage connection
            </Link>
          )}
        </div>
        <ShopifyDashboard connected={!!shopifyConn} />
      </main>
    </div>
  );
}
