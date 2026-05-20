import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { generateLogoImage } from "@/lib/openai";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

  // 3 slideshow generations per minute per user
  const rl = rateLimit(`slideshow:${userId}`, 3, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

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
    const imageList = (images as string[]).slice(0, count);

    for (let slideIdx = 0; slideIdx < imageList.length; slideIdx++) {
      const dataUrl = imageList[slideIdx];
      const isFirst = slideIdx === 0;
      const isLast  = slideIdx === imageList.length - 1 && imageList.length > 1;

      // Parse data URL → base64 + media type
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        slideContent.push({ title: isFirst ? description.trim().slice(0, 50) : "Untitled", subtitle: "" });
        continue;
      }
      const [, mediaType, data] = match;
      const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!supported.includes(mediaType)) {
        slideContent.push({ title: isFirst ? description.trim().slice(0, 50) : "Untitled", subtitle: "" });
        continue;
      }

      // Build a role-specific prompt per slide position
      let slidePrompt: string;
      if (isFirst) {
        slidePrompt = `You are creating the TITLE SLIDE (slide 1 of ${imageList.length}) for a presentation.
Presentation context: "${description}"

Generate a strong MAIN PRESENTATION TITLE (max 7 words) and a punchy TAGLINE (max 12 words) for this cover slide.
The title should be the name / headline of the entire presentation — bold and memorable.
The tagline should be a single supporting line that sets the tone.
Use the image for visual inspiration but the title represents the whole slideshow, not just this image.

Return ONLY valid JSON: {"title":"...","subtitle":"..."}`;
      } else if (isLast) {
        slidePrompt = `You are creating the CLOSING SLIDE (slide ${slideIdx + 1} of ${imageList.length}) for a presentation.
Presentation context: "${description}"

Generate a strong closing title (max 7 words) and a call-to-action subtitle (max 12 words).
Examples of good closing titles: "Get Started Today", "Join Us", "Ready to Transform?", "Let's Build Together"
The subtitle should be an action-oriented follow-up.

Return ONLY valid JSON: {"title":"...","subtitle":"..."}`;
      } else {
        slidePrompt = `You are creating slide ${slideIdx + 1} of ${imageList.length} for a presentation.
Presentation context: "${description}"

Look at this image and generate a punchy content slide title (max 7 words) and supporting subtitle (max 12 words) that fits both the image and the presentation context.

Return ONLY valid JSON: {"title":"...","subtitle":"..."}`;
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
              { type: "text", text: slidePrompt },
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
  const hasClosing = count > 2;
  const contentSlidesRange = count > 2 ? `slides 2–${count - 1}` : count === 2 ? "slide 2" : "";

  const structureInstructions = [
    `Slide 1: TITLE SLIDE — the main headline title of the entire presentation (bold, memorable, max 6 words) + a punchy one-line tagline (max 12 words). Background should feel like a hero/cover image.`,
    count > 1 && `${contentSlidesRange}: CONTENT SLIDES — each covering a distinct key point, feature, benefit, or section. Vary the backgrounds to give each slide its own mood.`,
    hasClosing && `Slide ${count}: CLOSING SLIDE — a strong call to action, key takeaway, or memorable closing statement. Background should feel conclusive and energising.`,
  ].filter(Boolean).join("\n");

  const contentResp = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `Create ${count} slides for a professional slideshow presentation about: "${description}"

SLIDE STRUCTURE (follow this exactly):
${structureInstructions}

For EACH slide generate:
- title: heading text (max 7 words) — for slide 1 this is the MAIN PRESENTATION TITLE
- subtitle: supporting line (max 14 words) — for slide 1 this is the TAGLINE
- backgroundDesc: vivid visual description for the AI background image (color palette, mood, shapes, textures — NO text in the image, NO slides of any kind visible)

Return ONLY a valid JSON array with no explanation or markdown:
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
  for (let i = 0; i < slideContent.slice(0, count).length; i++) {
    const slide = slideContent[i];
    const isTitle   = i === 0;
    const isClosing = i === slideContent.length - 1 && slideContent.length > 2;

    const slideRole = isTitle
      ? "Hero/cover presentation background. Full-bleed, dramatic, premium quality."
      : isClosing
      ? "Closing presentation background. Energising, conclusive, motivating."
      : `Content presentation slide background (slide ${i + 1} of ${count}).`;

    const prompt = `${slideRole} ${slide.backgroundDesc}. ${fontStyle}. No text, no words, no letters, no numbers visible anywhere in the image. Abstract or photographic background only. Clean minimal design, high contrast, widescreen 16:9 format, suitable for a professional business presentation.`;

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
