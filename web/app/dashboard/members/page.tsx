import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { MemberDirectory } from "@/components/member-directory";

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const me = await db.user.findUnique({
    where: { id: (session.user as any).id },
  });
  if (!me) redirect("/login");

  // Anyone with a non-empty profile (niche OR any skill) is shown.
  // Excludes the current user.
  const rawMembers = await db.user.findMany({
    where: {
      id: { not: me.id },
      profile: {
        OR: [{ niche: { not: null } }, { skills: { isEmpty: false } }],
      },
    },
    include: { profile: true },
    orderBy: [{ tier: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const isPaid = me.tier !== "FREE";

  const members = rawMembers.map((m) => ({
    id: m.id,
    name: m.name ?? "Member",
    image: m.image,
    tier: m.tier,
    niche: m.profile?.niche ?? null,
    skills: m.profile?.skills ?? [],
    lookingFor: m.profile?.lookingFor ?? [],
    canOffer: m.profile?.canOffer ?? [],
    socials: isPaid
      ? ((m.profile?.socials as Record<string, string>) ?? null)
      : null,
  }));

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={me} active="members" />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Member directory</h1>
            <p className="mt-3 text-text-muted">
              Founders, operators, and creators in the Fortress.
              {!isPaid && " Upgrade to see contact info + full filters."}
            </p>
          </div>
          <span className="text-sm text-text-muted">{members.length} members</span>
        </div>

        <MemberDirectory members={members} isPaid={isPaid} />
      </main>
    </div>
  );
}
