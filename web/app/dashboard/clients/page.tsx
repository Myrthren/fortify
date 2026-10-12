import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ClientContextManager } from "@/components/client-context-manager";
export default async function ClientsPage() {
  const session = await auth(); if (!session?.user) redirect("/login");
  const user = await db.user.findUnique({ where: { id: (session.user as any).id } }); if (!user) redirect("/login");
  return <div><DashboardNav user={user} active="dna" /><main className="mx-auto max-w-3xl px-4 py-10"><h1 className="text-2xl font-bold mb-5">Client contexts</h1>{user.tier === "FREE" ? <a href="/pricing">Compare paid plans to use client contexts</a> : <ClientContextManager />}</main></div>;
}
