import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { analyzeImageWithVision } from "@/lib/openai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
  if (!user || user.tier === "FREE") return NextResponse.json({ error: "Requires Pro+" }, { status: 403 });

  const { images, description } = await req.json(); // images: string[] (base64 dataURLs)
  if (!images?.length) return NextResponse.json({ error: "Images required" }, { status: 400 });

  // Analyze first reference image
  try {
    const criteria = await analyzeImageWithVision(images[0], `You are a professional logo designer. The user wants to create a new logo inspired by this reference image${images.length > 1 ? " (and similar references)" : ""}.
Their description: "${description || "not specified"}"

Extract design criteria for their new logo. Return a single paragraph (3-5 sentences) describing: color palette, style, typography feel, shapes/symbols, and overall aesthetic direction. Be specific and actionable. Do NOT describe what's in the reference — describe what the NEW logo should look like.`);

    return NextResponse.json({ criteria: criteria.trim() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
