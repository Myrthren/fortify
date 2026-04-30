import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const OWNER_DISCORD_ID = "731207920007643167";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const post = await db.dealPost.findUnique({ where: { id } });
  if (!post) return new NextResponse("Not found", { status: 404 });

  const user = await db.user.findUnique({ where: { id: userId } });
  const isOwner = user?.discordId === OWNER_DISCORD_ID;
  if (post.userId !== userId && !isOwner) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await db.dealPost.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
