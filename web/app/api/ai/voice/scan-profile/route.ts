import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { url } = await req.json();
  if (!url) return new NextResponse("URL required", { status: 400 });

  // Try to fetch the page
  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FortifyBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    html = await res.text();
    if (html.length > 60000) html = html.slice(0, 60000);
  } catch (e: any) {
    return new NextResponse(`Could not fetch profile: ${e.message}`, { status: 400 });
  }

  // Strip HTML
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 8000);

  const res = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `This is page content from a social media profile (TikTok or YouTube).\n\nExtract any visible post titles, video titles, captions, about/bio text, and content descriptions. Format them as writing samples separated by ---.\n\nIf you can't find meaningful content, return a few example placeholder samples.\n\nPage content:\n${text}\n\nReturn only the samples, nothing else.`,
    }],
  });

  const samples = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("\n")
    .trim();

  return NextResponse.json({ samples });
}
