import { chargeForResult, InsufficientCredits } from "@/lib/result-credits";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateLogoImage, analyzeImageWithVision } from "@/lib/openai";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const SIZE_MAP: Record<string, "1024x1024" | "1024x1536" | "1536x1024"> = {
  "500x500":  "1024x1024",
  "325x250":  "1024x1024",
  "160x600":  "1024x1536",
  "728x90":   "1536x1024",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  // 5 logo generations per minute per user
  const rl = rateLimit(`logo:${userId}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true, credits: true } });
  if (!user || user.tier === "FREE") return NextResponse.json({ error: "Requires Pro+" }, { status: 403 });
  if (user.credits < 150) return NextResponse.json({ error: "Need 150 credits" }, { status: 402 });

  const body = await req.json();
  const { prompt, aspectRatio, referenceImages, criteria } = body;
  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const size = SIZE_MAP[aspectRatio] ?? "1024x1024";

  // If criteria provided, use them directly; otherwise use the prompt
  const finalPrompt = criteria?.trim()
    ? `Create a professional logo. ${criteria}\n\nAdditional context: ${prompt}`
    : `Create a professional, high-quality logo for: ${prompt}. Make it clean, scalable, and suitable as a brand logo. Focus on creating actual logo design, not a photo.`;

  try {
    const imageUrl = await generateLogoImage(finalPrompt, size);

    if (typeof imageUrl !== "string" || !/^data:image\/[^;]+;base64,[A-Za-z0-9+/=]+$/.test(imageUrl))
      return NextResponse.json({ error: "No usable image returned. No credits charged." }, { status: 502 });
    await chargeForResult(userId, 150, "spend_logo_generate", async tx => tx.generation.create({
      data: { userId, type: "logo/generate", input: "", output: JSON.stringify(imageUrl) },
    }));

    return NextResponse.json({ image: imageUrl, creditsUsed: 150 });
  } catch (e: any) {
    if (e instanceof InsufficientCredits) return NextResponse.json({ error: e.message }, { status: 402 });
    return NextResponse.json({ error: e.message ?? "Generation failed" }, { status: 500 });
  }
}
