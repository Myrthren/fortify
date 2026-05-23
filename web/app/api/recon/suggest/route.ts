import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

export type DnaSuggestion = {
  location: string;
  category: string;
  rationale: string;
};

/**
 * GET /api/recon/suggest
 * Reads the user's Company DNA and asks Claude to generate
 * 5 ideal location + business category search combinations.
 * Requires ELITE or APEX. No credit cost.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (user.tier !== "ELITE" && user.tier !== "APEX") {
    return NextResponse.json({ error: "Requires Elite or Apex." }, { status: 403 });
  }

  const dna = await db.companyDna.findUnique({ where: { userId } });
  if (!dna) {
    return NextResponse.json(
      { error: "No Company DNA found. Add your DNA in the DNA section first." },
      { status: 400 }
    );
  }

  const entries = dna.entries as { label: string; content: string }[];
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json(
      { error: "Your Company DNA is empty. Fill it in first to generate search ideas." },
      { status: 400 }
    );
  }

  const dnaSummary = entries
    .map((e) => `${e.label}:\n${e.content}`)
    .join("\n\n");

  const msg = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 900,
    messages: [
      {
        role: "user",
        content: `You are a lead generation specialist. Based on this company's DNA, suggest 5 ideal location + business category search combinations to find the best prospects.

Company DNA:
${dnaSummary}

Return ONLY a valid JSON array (no markdown, no explanation, no code fences) in this exact format:
[
  {"location": "city or region", "category": "specific business type", "rationale": "one sentence why this is a good match"},
  ...
]

Rules:
- Use UK cities and regions only — vary them geographically
- Be specific with categories (e.g. "independent coffee shops" not just "cafes")
- Each combination should represent businesses that genuinely benefit from what this company offers
- Keep each rationale under 15 words
- Return exactly 5 items`,
      },
    ],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]";

  try {
    // Strip any accidental markdown fences Claude might add
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const suggestions: DnaSuggestion[] = JSON.parse(cleaned);
    return NextResponse.json({ suggestions });
  } catch {
    console.error("[recon/suggest] JSON parse failed:", raw);
    return NextResponse.json(
      { error: "Failed to generate suggestions. Please try again." },
      { status: 500 }
    );
  }
}
