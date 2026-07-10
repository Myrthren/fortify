import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { MemberDirectory } from "@/components/member-directory";
import { Users } from "lucide-react";

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const [me, rawMembers] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.user.findMany({
      where: {
        id: { not: userId },
        profile: {
          OR: [{ niche: { not: null } }, { skills: { isEmpty: false } }],
        },
      },
      include: { profile: true },
      orderBy: [{ tier: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);
  if (!me) redirect("/login");

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
    socials: isPaid ? ((m.profile?.socials as Record<string, string>) ?? null) : null,
  }));

  return (
    <div className="min-h-screen">
      <DashboardNav user={me} active="members" />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-bg-border">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(255,255,255,0.06) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Member Directory
          </h1>
          <p className="mt-2 text-text-muted">
            Founders, operators, and creators in the Fortress.
            {!isPaid && " Upgrade to see contact info + full filters."}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-bg-border bg-bg-panel px-3 py-1 text-xs text-text-muted">
              <Users className="h-3 w-3" />
              {members.length} members
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <MemberDirectory members={members} isPaid={isPaid} />
      </main>
    </div>
  );
}
