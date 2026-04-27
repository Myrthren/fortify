import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { Matchmaker } from "@/components/matchmaker";
import Link from "next/link";

export default async function MatchmakingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const me = await db.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!me) redirect("/login");

  const hasProfile = !!(
    me.profile &&
    (me.profile.niche || me.profile.skills.length > 0)
  );

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={me} active="matchmaking" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AI Matchmaking</h1>
          <p className="mt-3 text-text-muted">
            Claude reads your profile + every member, then surfaces who's worth a conversation —
            with a tailored opener.
          </p>
        </div>

        {me.tier === "FREE" ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <h3 className="font-semibold">AI Matchmaking is a Pro+ feature</h3>
            <p className="mt-1 text-sm text-text-muted">
              Get personalised match recommendations from the directory, with reasoning + a
              ready-to-send opener.
            </p>
            <Link href="/pricing" className="btn-primary mt-4 w-fit">Upgrade</Link>
          </div>
        ) : !hasProfile ? (
          <div className="card p-6">
            <h3 className="font-semibold">Add your profile first</h3>
            <p className="mt-1 text-sm text-text-muted">
              Set at least your niche and a few skills so Claude knows who to match you with.
            </p>
            <Link href="/dashboard/profile" className="btn-primary mt-4 w-fit">Edit profile</Link>
          </div>
        ) : (
          <Matchmaker />
        )}
      </main>
    </div>
  );
}
