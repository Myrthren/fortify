import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { discordId: true },
  });
  if (!isOwner(user?.discordId ?? null))
    return new NextResponse("Forbidden", { status: 403 });

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

  return NextResponse.json({ flaggedPosts, flaggedComments });
}
