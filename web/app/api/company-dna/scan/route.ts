import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

/**
 * POST /api/company-dna/scan
 * Accepts a URL (website or social media profile), fetches its content,
 * and uses Claude to extract structured business context ready to save to DNA.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { url, mode } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  // Fetch raw page HTML
  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FortifyBot/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    html = await res.text();
    if (html.length > 80000) html = html.slice(0, 80000);
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not fetch that URL: ${e.message}` },
      { status: 400 }
    );
  }

  // Strip scripts, styles, HTML tags down to readable text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10000);

  const isSocial = mode === "social";

  const prompt = isSocial
    ? `The following is text extracted from a social media profile page.\n\nExtract:\n- The creator/brand name\n- Their bio or about section\n- Their niche or content focus\n- Any notable stats (followers, views etc)\n- The tone and style of their content\n\nReturn a concise summary (2-4 paragraphs) that describes who this person/brand is, what they do, and how they communicate. Write in third person.\n\nPage text:\n${text}`
    : `The following is text extracted from a business website.\n\nExtract the following if present:\n- What the business does / their core offering\n- Who their target customers are\n- Their key value propositions or USPs\n- Any pricing or product information\n- The company mission or vision\n- Notable achievements, clients, or social proof\n\nReturn a concise, structured summary (3-5 paragraphs) capturing what this business is and what makes it unique. Write in third person.\n\nPage text:\n${text}`;

  const res = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("\n")
    .trim();

  if (!content) {
    return NextResponse.json({ error: "Could not extract meaningful content from that URL." }, { status: 422 });
  }

  // Generate a label from the URL
  let label: string;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    label = isSocial ? `Social profile – ${hostname}` : `Website – ${hostname}`;
  } catch {
    label = isSocial ? "Social profile scan" : "Website scan";
  }

  return NextResponse.json({ label, content });
}
