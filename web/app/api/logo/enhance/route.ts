import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enhanceLogoImage } from "@/lib/openai";

const SIZE_MAP: Record<string, "1024x1024" | "1024x1536" | "1536x1024"> = {
  "500x500": "1024x1024",
  "325x250": "1024x1024",
  "160x600": "1024x1536",
  "728x90":  "1536x1024",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true, credits: true } });
  if (!user || user.tier === "FREE") return NextResponse.json({ error: "Requires Pro+" }, { status: 403 });
  if (user.credits < 100) return NextResponse.json({ error: "Need 100 credits" }, { status: 402 });

  const { image, instructions, aspectRatio } = await req.json();
  if (!image) return NextResponse.json({ error: "Image required" }, { status: 400 });

  const size = SIZE_MAP[aspectRatio ?? "500x500"] ?? "1024x1024";
  const prompt = instructions?.trim()
    ? `Enhance this logo while maintaining its core identity. Apply these changes: ${instructions}. Keep it professional and scalable.`
    : "Enhance this logo to improve its visual quality, clarity, and professionalism while preserving the original concept.";

  try {
    const enhanced = await enhanceLogoImage(image, prompt, size);

    await db.user.update({ where: { id: userId }, data: { credits: { decrement: 100 } } });
    await db.creditTransaction.create({ data: { userId, amount: -100, source: "spend_logo_enhance" } });

    return NextResponse.json({ image: enhanced, creditsUsed: 100 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Enhancement failed" }, { status: 500 });
  }
}
