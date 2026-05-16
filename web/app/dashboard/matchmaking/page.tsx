import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { Matchmaker } from "@/components/matchmaker";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default async function MatchmakingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const me = await db.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!me) redirect("/login");

  const hasProfile = !!(me.profile && (me.profile.niche || me.profile.skills.length > 0));

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={me} active="matchmaking" />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-bg-border">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(255,255,255,0.06) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <h1
              className="text-4xl font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              AI Matchmaking
            </h1>
            <Sparkles className="h-5 w-5 text-text-muted" />
          </div>
          <p className="text-text-muted">
            Claude reads your profile + every member, then surfaces who&apos;s worth a conversation — with a tailored opener.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {me.tier === "FREE" ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <h3 className="font-semibold">AI Matchmaking is a Pro+ feature</h3>
            <p className="mt-1 text-sm text-text-muted">
              Get personalised match recommendations from the directory, with reasoning + a ready-to-send opener.
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
