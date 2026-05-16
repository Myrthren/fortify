import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const forums = await db.forum.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { posts: { where: { deleted: false } } } },
    },
  });
  return NextResponse.json({ forums });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.platformBanned || user.softwareBanned)
    return new NextResponse("Banned", { status: 403 });

  const { title, description } = await req.json();
  if (!title?.trim())
    return NextResponse.json({ error: "Title required" }, { status: 400 });

  const forum = await db.forum.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      createdById: userId,
    },
  });
  return NextResponse.json({ forum }, { status: 201 });
}
