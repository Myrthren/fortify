import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { CompanyDna } from "@/components/company-dna";

export default async function CompanyDnaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="dna" />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Company DNA</h1>
          <p className="mt-2 text-sm text-text-muted">
            Tell Fortify AI everything about your business. This context is used across all AI tools to give you personalised, relevant advice.
          </p>
        </div>
        <CompanyDna tier={user.tier} />
      </main>
    </div>
  );
}
