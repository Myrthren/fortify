import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateHooks } from "@/lib/openai";
import { generateInVoice } from "@/lib/voice";
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

  const { topic, platform = "TikTok / Reels" } = (await req.json()) as { topic: string; platform?: string };
  if (!topic || topic.length < 2) {
    return new NextResponse("Topic required", { status: 400 });
  }

  // If user has an active brand voice, generate via Claude with that voice.
  // Otherwise fall back to the OpenAI generic hook generator.
  const activeVoice = await db.brandVoice.findFirst({
    where: { userId, isActive: true },
    select: { systemPrompt: true, name: true },
  });

  let hooks: string[];
  let voiceUsed: string | null = null;

  if (activeVoice) {
    voiceUsed = activeVoice.name;
    const text = await generateInVoice({
      systemPrompt:
        activeVoice.systemPrompt +
        `\n\nWhen asked for hooks, output 5 original, scroll-stopping hooks. Vary the framing and opening. One per line, no numbering or hashtags.`,
      userPrompt: `Topic: ${topic}\nPlatform: ${platform.slice(0, 40)}\n\nWrite 5 hooks tailored to the platform.`,
      maxTokens: 400,
    });
    hooks = text
      .split("\n")
      .map((l) => l.trim().replace(/^[-•\d.)\]]+\s*/, ""))
      .filter(Boolean)
      .slice(0, 5);
  } else {
    hooks = await generateHooks(`${topic}\nPlatform: ${platform.slice(0, 40)}`, 5);
  }

  const output = hooks.join("\n");
  await logGeneration({ userId, type: "hook", input: `${topic}\nPlatform: ${platform}`, output });

  return NextResponse.json({ hooks, voice: voiceUsed });
}
