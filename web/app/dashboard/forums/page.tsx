import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ForumsClient } from "@/components/forums-client";

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

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="forums" />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Forums</h1>
            <p className="mt-1 text-sm text-text-muted">
              Discuss, share, and connect with the Fortify community.
            </p>
          </div>
        </div>
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
