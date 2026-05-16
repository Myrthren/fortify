import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || (user.tier !== "ELITE" && user.tier !== "APEX")) {
    return new NextResponse("Elite+ feature", { status: 403 });
  }

  const { term, results } = await req.json();

  // Load Company DNA
  const dna = await db.companyDna.findUnique({ where: { userId } });
  const dnaContext =
    dna && Array.isArray(dna.entries) && (dna.entries as any[]).length > 0
      ? (dna.entries as any[]).map((e: any) => `${e.label}: ${e.content}`).join("\n")
      : null;

  if (!dnaContext) {
    return NextResponse.json({
      insight: "Add your Company DNA in Settings to get personalised trend insights.",
    });
  }

  const res = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `Business context:\n${dnaContext}\n\nTrending topic: "${term}"\n\nRecent results on this topic:\n${results
          .slice(0, 5)
          .map((r: any) => `- ${r.title}: ${r.description ?? ""}`)
          .join(
            "\n"
          )}\n\nGive 2-3 specific, actionable ways this business can leverage this trend. Be concrete and direct. Under 150 words.`,
      },
    ],
  });

  const insight = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("")
    .trim();
  return NextResponse.json({ insight });
}
