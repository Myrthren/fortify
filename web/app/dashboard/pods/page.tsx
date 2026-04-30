import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import Link from "next/link";

export default async function PodsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
    include: {
      pods: {
        include: {
          pod: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, name: true, tier: true, profile: { select: { niche: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!user) redirect("/login");

  const myPod = user.pods[0]?.pod ?? null;
  const members = myPod?.members.map((m) => m.user).filter((u) => u.id !== user.id) ?? [];

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="pods" />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Mastermind Pod</h1>
        <p className="mb-8 text-text-muted">Your accountability circle — a small group of operators committed to showing up.</p>

        {user.tier !== "APEX" ? (
          <div className="card p-6">
            <p className="font-medium">Mastermind Pods are an Apex feature.</p>
            <p className="mt-1 text-sm text-text-muted">Upgrade to Apex ($199/mo) to get auto-assigned to a pod of 3–5 operators.</p>
            <Link href="/pricing" className="mt-4 inline-block text-sm underline underline-offset-2">
              See Apex →
            </Link>
          </div>
        ) : !myPod ? (
          <div className="card p-6">
            <p className="font-medium">You're not in a pod yet.</p>
            <p className="mt-1 text-sm text-text-muted">Pods are auto-assigned by the community manager. Message in Discord to get added.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-lg font-semibold">{myPod.name}</h2>
              <p className="mt-1 text-sm text-text-muted">{members.length + 1} members</p>
            </div>
            {members.map((m) => (
              <div key={m.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{m.name ?? "Anonymous"}</p>
                  {m.profile?.niche && <p className="text-sm text-text-muted">{m.profile.niche}</p>}
                </div>
                <span className="rounded border border-white/10 px-2 py-0.5 text-xs text-text-muted">{m.tier}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
