import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const posts = await db.dealPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true } } },
  });
  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.tier === "FREE") {
    return NextResponse.json({ error: "Deal Board posting is a paid feature." }, { status: 403 });
  }

  const { title, description, type, budget, link } = await req.json();
  if (!title || !description || !type) {
    return new NextResponse("title, description, and type required", { status: 400 });
  }
  if (!["HIRING", "COLLAB", "OPPORTUNITY"].includes(type)) {
    return new NextResponse("Invalid type", { status: 400 });
  }

  const post = await db.dealPost.create({
    data: { userId, title: title.slice(0, 100), description: description.slice(0, 1000), type, budget: budget ?? null, link: link ?? null },
  });
  return NextResponse.json({ post }, { status: 201 });
}
