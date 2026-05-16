import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { ModerationClient } from "@/components/admin-moderation";

export default async function AdminModerationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { discordId: true },
  });
  if (!isOwner(user?.discordId ?? null)) redirect("/dashboard");

  const [flaggedPosts, flaggedComments] = await Promise.all([
    db.forumPost.findMany({
      where: { flagged: true, deleted: false },
      include: {
        user: { select: { name: true, username: true } },
        forum: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.forumComment.findMany({
      where: { flagged: true, deleted: false },
      include: {
        user: { select: { name: true, username: true } },
        post: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <ModerationClient
      flaggedPosts={flaggedPosts as any}
      flaggedComments={flaggedComments as any}
    />
  );
}
