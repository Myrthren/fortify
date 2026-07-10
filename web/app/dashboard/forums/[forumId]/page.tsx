import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ForumDetailClient } from "@/components/forum-detail-client";

export default async function ForumDetailPage({
  params,
}: {
  params: Promise<{ forumId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;
  const { forumId } = await params;

  const [user, forum, posts] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.forum.findUnique({ where: { id: forumId } }),
    db.forumPost.findMany({
      where: { forumId, deleted: false },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            avatarUrl: true,
            tier: true,
          },
        },
        _count: { select: { comments: { where: { deleted: false } } } },
      },
    }),
  ]);

  if (!user) redirect("/login");
  if (!forum) redirect("/dashboard/forums");

  return (
    <div className="min-h-screen">
      <DashboardNav user={user} active="forums" />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <ForumDetailClient
          forum={{
            id: forum.id,
            title: forum.title,
            description: forum.description,
          }}
          initialPosts={posts.map((p) => ({
            ...p,
            commentCount: p._count.comments,
            createdAt: p.createdAt.toISOString(),
          }))}
          isBanned={user.platformBanned || user.softwareBanned}
          currentUserId={userId}
        />
      </main>
    </div>
  );
}
