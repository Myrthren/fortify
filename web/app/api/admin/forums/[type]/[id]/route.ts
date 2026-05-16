import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { discordId: true },
  });
  if (!isOwner(user?.discordId ?? null))
    return new NextResponse("Forbidden", { status: 403 });

  const { type, id } = await params;
  const { action } = await req.json(); // "approve" | "delete"

  if (type === "post") {
    if (action === "approve") {
      await db.forumPost.update({ where: { id }, data: { flagged: false } });
    } else if (action === "delete") {
      await db.forumPost.update({ where: { id }, data: { deleted: true } });
      // Check if user has 3 deleted posts in the last 30 days — auto-suspend
      const post = await db.forumPost.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (post) {
        const recentDeleted = await db.forumPost.count({
          where: {
            userId: post.userId,
            deleted: true,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        });
        if (recentDeleted >= 3) {
          await db.banRecord.create({
            data: {
              userId: post.userId,
              type: "PLATFORM",
              reason:
                "3 forum posts deleted for inappropriate content within 30 days",
              permanent: false,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          await db.user.update({
            where: { id: post.userId },
            data: { platformBanned: true },
          });
        }
      }
    }
  } else if (type === "comment") {
    if (action === "approve") {
      await db.forumComment.update({ where: { id }, data: { flagged: false } });
    } else if (action === "delete") {
      await db.forumComment.update({ where: { id }, data: { deleted: true } });
      const comment = await db.forumComment.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (comment) {
        const recentDeleted = await db.forumComment.count({
          where: {
            userId: comment.userId,
            deleted: true,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        });
        if (recentDeleted >= 3) {
          await db.banRecord.create({
            data: {
              userId: comment.userId,
              type: "PLATFORM",
              reason:
                "3 forum comments deleted for inappropriate content within 30 days",
              permanent: false,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          await db.user.update({
            where: { id: comment.userId },
            data: { platformBanned: true },
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
