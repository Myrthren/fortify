import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ForumsClient } from "@/components/forums-client";
import { MessageSquare } from "lucide-react";

export default async function ForumsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;

  const [user, forums] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.forum.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { posts: { where: { deleted: false } } } } },
    }),
  ]);

  if (!user) redirect("/login");
  if (user.softwareBanned) redirect("/banned");

  const totalPosts = forums.reduce((sum, f) => sum + f._count.posts, 0);

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="forums" />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-bg-border">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(255,255,255,0.06) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Forums
          </h1>
          <p className="mt-2 text-text-muted">Discuss, share, and connect with the Fortify community.</p>
          {forums.length > 0 && (
            <div className="mt-4 flex gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-bg-border bg-bg-panel px-3 py-1 text-xs text-text-muted">
                <MessageSquare className="h-3 w-3" />
                {forums.length} boards · {totalPosts} posts
              </span>
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <ForumsClient
          initialForums={forums.map((f) => ({
            ...f,
            postCount: f._count.posts,
            createdAt: f.createdAt.toISOString(),
          }))}
          isBanned={user.platformBanned}
        />
      </main>
    </div>
  );
}
