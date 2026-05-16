import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { LogoIntelligence } from "@/components/logo-intelligence";
import { Wand2 } from "lucide-react";

export default async function LogoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");
  if (user.tier === "FREE") redirect("/dashboard?upgrade=logo");

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="logo" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Logo Intelligence</h1>
            <span className="rounded-md border border-bg-border bg-bg-panel px-2 py-0.5 text-xs text-text-muted">
              {user.credits.toLocaleString()} credits
            </span>
          </div>
          <p className="text-text-muted">
            Generate professional logos from scratch, or enhance your existing logo with AI feedback.
          </p>
        </div>

        <LogoIntelligence credits={user.credits} />
      </main>
    </div>
  );
}
