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
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const comments = await db.forumComment.findMany({
    where: { postId, deleted: false },
    orderBy: { createdAt: "asc" },
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
  return NextResponse.json({ comments });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.platformBanned || user.softwareBanned)
    return new NextResponse("Banned", { status: 403 });

  const { postId } = await params;
  const { body } = await req.json();
  if (!body?.trim())
    return NextResponse.json({ error: "Body required" }, { status: 400 });

  const flagged = await checkSpam(body);

  const comment = await db.forumComment.create({
    data: { postId, userId, body: body.trim(), flagged },
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

  return NextResponse.json({ comment, flagged }, { status: 201 });
}
