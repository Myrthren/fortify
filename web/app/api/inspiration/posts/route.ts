import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { braveSearch } from "@/lib/brave";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

type InspirationPost = {
  hook: string;
  angle: string;
  format: string;
  source: { title: string; url: string };
};

/**
 * POST /api/inspiration/posts
 * Body: { niche: string }
 * Searches Reddit via Brave for top posts in the niche, extracts hook patterns via Claude.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (!TIER_LIMITS[user.tier].contentInspiration) {
    return NextResponse.json(
      { error: "Content Inspiration is a Pro+ feature.", upgrade: true },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const niche = (body.niche ?? "").trim();
  const platform = typeof body.platform === "string" ? body.platform.slice(0, 40) : "TikTok / Reels";
  if (!niche || niche.length < 2) {
    return NextResponse.json({ error: "Niche is required (min 2 chars)." }, { status: 400 });
  }

  try {
    // Brave Search: restrict to Reddit, past month, up to 20 results
    const items = await braveSearch({
      query: `site:reddit.com ${niche}`,
      count: 20,
      freshness: "pm",
    });

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No Reddit posts found for that niche. Try a broader term." },
        { status: 422 }
      );
    }

    const postsText = items
      .map((p) => `- "${p.title}"\n  ${p.description ?? ""}`)
      .join("\n");

    const voice = await db.brandVoice.findFirst({ where: { userId, isActive: true }, select: { systemPrompt: true, name: true } });
    const msg = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `You are a content strategist. Analyse these top Reddit posts about "${niche}" and extract 6 distinct content angles that clearly resonate with this audience. For each, give an original hook, the underlying angle, and the best content format for ${platform}. Every result must be grounded in the supplied sources; never invent a trend, quote, result, or audience claim.${voice ? `\n\nBrand voice (${voice.name}):\n${voice.systemPrompt}` : ""}

Posts:
${postsText}

Return ONLY a JSON array of 6 objects: [{ "hook": string, "angle": string, "format": string }]`,
        },
      ],
    });

    const raw = (msg.content[0] as any).text as string;
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Claude returned invalid JSON");
    const patterns: Omit<InspirationPost, "source">[] = JSON.parse(jsonMatch[0]);

    const results: InspirationPost[] = patterns.map((p, i) => ({
      ...p,
      source: {
        title: items[i]?.title ?? "",
        url: items[i]?.url ?? "",
      },
    }));

    await db.generation.create({
      data: { userId, type: "inspiration-posts", input: niche, output: JSON.stringify(results) },
    });

    return NextResponse.json({ niche, platform, voice: voice?.name ?? null, results });
  } catch (e: any) {
    console.error("[inspiration/posts] failed", e);
    return new NextResponse(`Failed: ${e.message}`, { status: 500 });
  }
}
