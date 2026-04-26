import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { TIERS } from "@/lib/tiers";
import { Logo } from "@/components/logo";
import { TierSwitcher } from "@/components/tier-switcher";
import Link from "next/link";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
  });
  if (!user) redirect("/login");
  if (!isOwner(user.discordId)) redirect("/dashboard");

  const tierMeta = TIERS[user.tier];
  const allUsers = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      discordId: true,
      tier: true,
      createdAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bg-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Logo withWord />
            <span className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-200">
              Admin
            </span>
          </div>
          <Link href="/dashboard" className="text-sm text-text-muted hover:text-text">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 space-y-10">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Your tier</h2>
          <p className="mt-1 text-sm text-text-muted">
            Currently on <span className="text-text">{tierMeta.name}</span>. Switch
            for testing — no PayPal subscription is created.
          </p>
          <div className="mt-4">
            <TierSwitcher current={user.tier} />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Recent users</h2>
          <p className="mt-1 text-sm text-text-muted">Last 50 by created date.</p>
          <div className="mt-4 overflow-hidden rounded-lg border border-bg-border bg-bg-panel">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-bg-border bg-black/20">
                <tr>
                  <th className="px-4 py-2 font-medium text-text-muted">Name</th>
                  <th className="px-4 py-2 font-medium text-text-muted">Email</th>
                  <th className="px-4 py-2 font-medium text-text-muted">Tier</th>
                  <th className="px-4 py-2 font-medium text-text-muted">Joined</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id} className="border-b border-bg-border/50 last:border-0">
                    <td className="px-4 py-2">{u.name ?? "—"}</td>
                    <td className="px-4 py-2 text-text-muted">{u.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className="rounded border border-bg-border bg-black/20 px-1.5 py-0.5 text-xs">
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-text-muted">
                      {u.createdAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
