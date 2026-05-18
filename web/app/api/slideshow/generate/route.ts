import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { generateLogoImage } from "@/lib/openai";

const FONT_STYLES: Record<string, string> = {
  "Inter":            "clean modern sans-serif typography",
  "Montserrat":       "bold geometric sans-serif typography",
  "Playfair Display": "elegant high-contrast serif typography",
  "Bebas Neue":       "bold condensed display typography",
  "Poppins":          "rounded friendly sans-serif typography",
  "Oswald":           "strong narrow sans-serif typography",
  "Lato":             "humanist clean sans-serif typography",
  "Raleway":          "thin elegant sans-serif with distinctive W",
  "Roboto Mono":      "technical monospaced typography",
  "Merriweather":     "traditional readable serif typography",
  "Space Grotesk":    "futuristic geometric sans-serif typography",
  "Outfit":           "contemporary minimal sans-serif typography",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true, credits: true } });
  if (!user || user.tier === "FREE") return NextResponse.json({ error: "Requires Pro+" }, { status: 403 });

  const body = await req.json();
  const { description, font, slideCount, images } = body;
  if (!description?.trim()) return NextResponse.json({ error: "Description required" }, { status: 400 });

  const hasOwnImages = Array.isArray(images) && images.length > 0;
  const count = hasOwnImages
    ? Math.min(images.length, 10)
    : Math.min(Math.max(1, parseInt(slideCount) || 3), 10);

  // Own images cost 5 credits/slide (Claude vision only), AI backgrounds cost 15 credits/slide (DALL-E)
  const costPerSlide = hasOwnImages ? 5 : 15;
  const creditCost = count * costPerSlide;

  if (user.credits < creditCost) {
    return NextResponse.json({ error: `Need ${creditCost} credits (${count} slides × ${costPerSlide})` }, { status: 402 });
  }

  const fontStyle = FONT_STYLES[font] ?? "clean modern typography";

  // ── Own images path ──────────────────────────────────────────────────────────
  if (hasOwnImages) {
    const slideContent: { title: string; subtitle: string }[] = [];

    for (const dataUrl of (images as string[]).slice(0, count)) {
      // Parse data URL → base64 + media type
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        slideContent.push({ title: "Untitled", subtitle: "" });
        continue;
      }
      const [, mediaType, data] = match;
      // Only send supported image types to Claude
      const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!supported.includes(mediaType)) {
        slideContent.push({ title: "Untitled", subtitle: "" });
        continue;
      }

      try {
        const resp = await claude().messages.create({
          model: CLAUDE_MODELS.fast,
          max_tokens: 150,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data },
              },
              {
                type: "text",
                text: `You are creating presentation slide text for this image. Context: "${description}".

Generate a punchy slide title (max 8 words) and a supporting subtitle (max 15 words) that fits both the image and context.

Return ONLY valid JSON with no explanation: {"title":"...","subtitle":"..."}`,
              },
            ],
          }],
        });

        const raw = (resp.content as any[]).filter(b => b.type === "text").map(b => b.text).join("");
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          slideContent.push({
            title:    parsed.title    ?? "Untitled",
            subtitle: parsed.subtitle ?? "",
          });
        } else {
          slideContent.push({ title: "Untitled", subtitle: "" });
        }
      } catch {
        slideContent.push({ title: "Untitled", subtitle: "" });
      }
    }

    const actualCost = slideContent.length * costPerSlide;
    await db.user.update({ where: { id: userId }, data: { credits: { decrement: actualCost } } });
    await db.creditTransaction.create({ data: { userId, amount: -actualCost, source: "spend_slideshow" } });

    return NextResponse.json({
      images: (images as string[]).slice(0, count),
      slideContent,
      creditsUsed: actualCost,
    });
  }

  // ── AI backgrounds path (original flow) ─────────────────────────────────────
  const contentResp = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `Create ${count} slides for a slideshow about: "${description}"

For each slide, generate:
- title: short punchy heading (max 8 words)
- subtitle: one supporting line (max 15 words)
- backgroundDesc: vivid description of the slide's background/visual (color, mood, shapes — no text in this)

Return ONLY valid JSON array, no explanation:
[{"title":"...","subtitle":"...","backgroundDesc":"..."}]`,
    }],
  });

  const contentText = (contentResp.content as any[]).filter(b => b.type === "text").map(b => b.text).join("");
  const jsonMatch = contentText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return NextResponse.json({ error: "Failed to generate slide content" }, { status: 500 });

  let slideContent: { title: string; subtitle: string; backgroundDesc: string }[];
  try {
    slideContent = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Invalid slide content from AI" }, { status: 500 });
  }

  const generatedImages: string[] = [];
  for (const slide of slideContent.slice(0, count)) {
    const prompt = `Professional presentation slide. ${slide.backgroundDesc}. Centered text layout. Large bold title text reads exactly: "${slide.title}". Below it, subtitle text reads: "${slide.subtitle}". ${fontStyle}. Clean minimal design, high contrast, suitable for business presentation.`;
    try {
      const img = await generateLogoImage(prompt, "1536x1024");
      generatedImages.push(img);
    } catch {
      generatedImages.push("");
    }
  }

  const actualCount = generatedImages.filter(Boolean).length;
  const actualCost = actualCount * costPerSlide;
  await db.user.update({ where: { id: userId }, data: { credits: { decrement: actualCost } } });
  await db.creditTransaction.create({ data: { userId, amount: -actualCost, source: "spend_slideshow" } });

  return NextResponse.json({ images: generatedImages, slideContent: slideContent.slice(0, count), creditsUsed: actualCost });
}
