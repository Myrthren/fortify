import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ConnectionsClient } from "@/components/connections-client";

export default async function ConnectionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");
  if (user.softwareBanned) redirect("/banned");
  if (user.platformBanned) redirect("/dashboard?banned=platform");

  const [connections, pending] = await Promise.all([
    db.userConnection.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
        status: "ACCEPTED",
      },
      include: {
        from: { select: { id: true, name: true, username: true, avatarUrl: true, image: true, tier: true, profile: { select: { niche: true } } } },
        to: { select: { id: true, name: true, username: true, avatarUrl: true, image: true, tier: true, profile: { select: { niche: true } } } },
      },
    }),
    db.userConnection.findMany({
      where: { toUserId: userId, status: "PENDING" },
      include: { from: { select: { id: true, name: true, username: true, avatarUrl: true, image: true } } },
    }),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="connections" />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight mb-8">Connections</h1>
        <ConnectionsClient
          currentUserId={userId}
          initialConnections={connections.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          }))}
          initialPending={pending.map((p) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
