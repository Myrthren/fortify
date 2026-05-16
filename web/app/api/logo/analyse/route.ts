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

  const { image } = await req.json();
  if (!image) return NextResponse.json({ error: "Image required" }, { status: 400 });

  try {
    const analysis = await analyzeImageWithVision(image, `Analyse this logo design as a professional brand designer. Return JSON only:
{
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "overallScore": 7,
  "summary": "2-sentence overall assessment"
}`);

    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Analysis parse error" }, { status: 500 });
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Analysis failed" }, { status: 500 });
  }
}
