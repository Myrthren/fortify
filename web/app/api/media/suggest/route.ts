import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

const CATEGORIES = [
  "Business", "Education", "Entertainment", "Comedy", "Lifestyle",
  "Fitness", "Food", "Travel", "Tech", "Finance", "Gaming", "Beauty", "Music",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true, credits: true } });
  if (!user) return new NextResponse("Not found", { status: 404 });
  if (user.tier === "FREE") return NextResponse.json({ error: "Requires Pro+" }, { status: 403 });
  if (user.credits < 25) return NextResponse.json({ error: "Not enough credits (need 25)" }, { status: 402 });

  const { frame, platforms, filename } = await req.json();
  if (!frame) return NextResponse.json({ error: "No frame provided" }, { status: 400 });

  // Extract base64 data from dataURL
  const base64Data = frame.replace(/^data:image\/\w+;base64,/, "");
  const mediaType = frame.match(/^data:(image\/\w+);base64,/)?.[1] ?? "image/jpeg";

  const platformList = Array.isArray(platforms) ? platforms.join(", ") : "general";
  const categoriesStr = CATEGORIES.join(", ");

  try {
    const resp = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as any, data: base64Data },
            },
            {
              type: "text",
              text: `You are helping a content creator optimise their video for ${platformList}.

This is a frame extracted from their video (filename: "${filename}").

Based on what you see in this frame, suggest:
1. A compelling, click-worthy title (under 70 chars, naturally include 1-2 relevant hashtags if it fits)
2. A description (100-150 words, engaging, include 3-5 hashtags at the end)
3. The most appropriate category from this list: ${categoriesStr}

Respond ONLY with valid JSON in this exact format, no explanation:
{
  "title": "...",
  "description": "...",
  "category": "..."
}`,
            },
          ],
        },
      ],
    } as any);

    const text = (resp.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]);
    if (!result.title || !result.description || !result.category) {
      return NextResponse.json({ error: "Incomplete AI response" }, { status: 500 });
    }

    // Deduct 25 credits
    await db.user.update({
      where: { id: userId },
      data: { credits: { decrement: 25 } },
    });
    await db.creditTransaction.create({
      data: { userId, amount: -25, source: "spend_virality_suggest" },
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "AI analysis failed" }, { status: 500 });
  }
}
