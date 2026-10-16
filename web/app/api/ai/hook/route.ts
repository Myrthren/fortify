import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateHooks } from "@/lib/openai";
import { generateInVoice } from "@/lib/voice";
import { canGenerate, logGeneration } from "@/lib/usage";
import { unsupportedFigures } from "@/lib/facts";

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

  let voiceUsed: string | null = activeVoice?.name ?? null;
  const generate = async (useVoice = Boolean(activeVoice)): Promise<string[]> => {
    if (!useVoice || !activeVoice) return generateHooks(`${topic}\nPlatform: ${platform.slice(0, 40)}`, 5);
    const text = await generateInVoice({
      systemPrompt:
        activeVoice.systemPrompt +
        `\n\nWhen asked for hooks, output 5 original, scroll-stopping hooks. Vary the framing and opening. One per line, no numbering or hashtags. Never invent statistics, percentages or results.`,
      userPrompt: `Topic: ${topic}\nPlatform: ${platform.slice(0, 40)}\n\nWrite 5 hooks tailored to the platform.`,
      maxTokens: 400,
    });
    return text
      .split("\n")
      // Strip list markers ("1.", "2)", "-", "•") only; a leading number such
      // as "47 clients..." is content and must reach the figure check intact.
      .map((l) => l.trim().replace(/^(?:[-•*]|\d+[.)\]])\s*/, ""))
      .filter(Boolean)
      .slice(0, 5);
  };

  // Drop hooks that cite figures the topic didn't supply; top up once if
  // that leaves too few to be useful.
  const flagged: string[] = [];
  const keep = (lines: string[]) =>
    lines.filter((h) => {
      const figures = unsupportedFigures(h, topic);
      flagged.push(...figures);
      return !figures.length;
    });
  const first = await generate();
  let rawLines = first.length;
  let hooks = keep(first);
  if (hooks.length < 3) {
    const second = await generate();
    rawLines += second.length;
    hooks = [...new Set([...hooks, ...keep(second)])].slice(0, 5);
  }
  // Some voices lean on figures in every line. Fall back to the plain
  // generator rather than show nothing.
  if (!hooks.length && activeVoice) {
    const plain = await generate(false);
    rawLines += plain.length;
    hooks = keep(plain);
    voiceUsed = null;
  }
  // Never report success with nothing to show. Log figures and counts only.
  // 503, not 502: the Cloudflare proxy replaces 502 bodies with its own page.
  if (!hooks.length) {
    console.warn(`[hook] no usable hooks (raw lines: ${rawLines}, voice: ${Boolean(activeVoice)}, flagged: ${[...new Set(flagged)].join(" ")})`);
    return NextResponse.json({ error: "Couldn't generate usable hooks this time. Please try again." }, { status: 503 });
  }
  if (flagged.length) console.info(`[hook] dropped lines citing: ${[...new Set(flagged)].join(" ")}`);

  const output = hooks.join("\n");
  await logGeneration({ userId, type: "hook", input: `${topic}\nPlatform: ${platform}`, output });

  return NextResponse.json({ hooks, voice: voiceUsed });
}
