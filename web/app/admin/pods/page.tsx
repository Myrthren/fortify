export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import Link from "next/link";
import { PodsClient } from "./client";

export default async function AdminPodsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const me = await db.user.findUnique({ where: { id: (session.user as any).id } });
  if (!me || !isOwner(me.discordId)) redirect("/dashboard");

  const [pods, apexUsers] = await Promise.all([
    db.pod.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, username: true, tier: true, discordId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { tier: "APEX" },
      select: { id: true, email: true, username: true, discordId: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-bg-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <h1 className="font-semibold">Mastermind Pods</h1>
          <Link href="/admin" className="text-sm text-text-muted hover:text-text">
            ← Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <PodsClient
          initialPods={pods.map((p) => ({
            id: p.id,
            name: p.name,
            members: p.members.map((m) => ({
              userId: m.userId,
              user: m.user,
            })),
          }))}
          apexUsers={apexUsers}
        />
      </main>
    </div>
  );
}
