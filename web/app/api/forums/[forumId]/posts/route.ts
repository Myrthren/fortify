import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

async function checkSpam(text: string): Promise<boolean> {
  try {
    const res = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: `Is this forum message spam, inappropriate, or violating community guidelines? Reply only "yes" or "no".\n\nMessage: "${text.slice(0, 500)}"`,
        },
      ],
    });
    const answer = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("")
      .toLowerCase()
      .trim();
    return answer.startsWith("yes");
  } catch {
    return false;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ forumId: string }> }
) {
  const { forumId } = await params;
  const posts = await db.forumPost.findMany({
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
  });
  return NextResponse.json({ posts });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ forumId: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.platformBanned || user.softwareBanned)
    return new NextResponse("Banned", { status: 403 });

  const { forumId } = await params;
  const { title, body } = await req.json();
  if (!title?.trim() || !body?.trim())
    return NextResponse.json(
      { error: "Title and body required" },
      { status: 400 }
    );

  const flagged = await checkSpam(`${title} ${body}`);

  const post = await db.forumPost.create({
    data: { forumId, userId, title: title.trim(), body: body.trim(), flagged },
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
    },
  });

  return NextResponse.json({ post, flagged }, { status: 201 });
}
