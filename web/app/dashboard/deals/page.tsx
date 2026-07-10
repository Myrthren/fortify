import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { DealForm } from "@/components/deal-form";
import { DealDelete } from "@/components/deal-delete";
import Link from "next/link";
import { Briefcase, Users, TrendingUp, ExternalLink, Wallet } from "lucide-react";

export default async function DealsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [user, posts] = await Promise.all([
    db.user.findUnique({ where: { id: (session.user as any).id } }),
    db.dealPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, username: true } } },
    }),
  ]);
  if (!user) redirect("/login");

  const TYPE_CONFIG = {
    HIRING: {
      label: "Hiring",
      badgeClass: "bg-blue-500/10 text-blue-300 border-blue-500/25",
      icon: <Briefcase className="h-3 w-3" />,
    },
    COLLAB: {
      label: "Collab",
      badgeClass: "bg-green-500/10 text-green-300 border-green-500/25",
      icon: <Users className="h-3 w-3" />,
    },
    OPPORTUNITY: {
      label: "Opportunity",
      badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/25",
      icon: <TrendingUp className="h-3 w-3" />,
    },
  } as const;

  const counts = {
    HIRING: posts.filter((p) => p.type === "HIRING").length,
    COLLAB: posts.filter((p) => p.type === "COLLAB").length,
    OPPORTUNITY: posts.filter((p) => p.type === "OPPORTUNITY").length,
  };

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="deals" />

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden border-b border-bg-border">
        {/* Gradient background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(255,255,255,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="text-4xl font-bold tracking-tight sm:text-5xl"
                style={{
                  background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Deal Board
              </h1>
              <p className="mt-2 text-text-muted">
                Hiring, collabs, and opportunities from the Fortress.
              </p>
              {/* Stat pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {(["HIRING", "COLLAB", "OPPORTUNITY"] as const).map((type) => {
                  const cfg = TYPE_CONFIG[type];
                  return (
                    <span
                      key={type}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cfg.badgeClass}`}
                    >
                      {cfg.icon}
                      {counts[type]} {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>
            {user.tier !== "FREE" && (
              <div className="shrink-0">
                <DealForm />
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-bg-border"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)" }}
            >
              <Briefcase className="h-7 w-7 text-text-muted opacity-50" />
            </div>
            <p className="text-base font-medium text-text-muted">No deals posted yet.</p>
            <p className="mt-1 text-sm text-text-dim">Be the first to post a hiring ad, collab, or opportunity.</p>
            {user.tier !== "FREE" && (
              <div className="mt-6">
                <DealForm />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const cfg = TYPE_CONFIG[post.type as "HIRING" | "COLLAB" | "OPPORTUNITY"];
              const displayName = (post.user as any).username
                ? `@${(post.user as any).username}`
                : post.user.name ?? "Anonymous";
              return (
                <div
                  key={post.id}
                  className="group relative rounded-xl border border-bg-border bg-bg-panel p-5 transition-all duration-200 hover:border-white/[0.12] hover:bg-bg-elevated hover:-translate-y-0.5 hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
                >
                  {/* Subtle left accent line */}
                  <div
                    className={`absolute left-0 top-4 h-8 w-0.5 rounded-r-full opacity-60 ${
                      post.type === "HIRING" ? "bg-blue-400" : post.type === "COLLAB" ? "bg-green-400" : "bg-amber-400"
                    }`}
                  />
                  <div className="flex items-start justify-between gap-4 pl-3">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg.badgeClass}`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </span>
                        <span className="text-xs text-text-muted">{displayName}</span>
                        <span className="text-text-dim text-xs">·</span>
                        <span className="text-xs text-text-dim">
                          {post.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <h3 className="font-semibold leading-snug group-hover:text-white transition-colors">{post.title}</h3>
                      <p className="mt-1.5 text-sm text-text-muted leading-relaxed">
                        {post.description.slice(0, 280)}
                        {post.description.length > 280 ? "…" : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs">
                        {post.budget && (
                          <span className="flex items-center gap-1 text-text-muted">
                            <Wallet className="h-3 w-3" /> {post.budget}
                          </span>
                        )}
                        {post.link && (
                          <Link
                            href={post.link}
                            className="flex items-center gap-1 text-text-muted hover:text-text transition underline-offset-2 hover:underline"
                            target="_blank"
                          >
                            View link <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                    {(post.userId === user.id || user.discordId === "731207920007643167") && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <DealDelete id={post.id} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
