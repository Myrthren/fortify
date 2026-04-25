import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateHooks } from "@/lib/openai";
import { canGenerate, logGeneration } from "@/lib/usage";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const ok = await canGenerate(userId, user.tier);
  if (!ok) {
    return NextResponse.json(
      { error: "Daily limit reached. Upgrade for unlimited.", upgrade: true },
      { status: 429 }
    );
  }

  const { topic } = (await req.json()) as { topic: string };
  if (!topic || topic.length < 2) {
    return new NextResponse("Topic required", { status: 400 });
  }

  const hooks = await generateHooks(topic, 5);
  const output = hooks.join("\n");

  await logGeneration({ userId, type: "hook", input: topic, output });

  return NextResponse.json({ hooks });
}
