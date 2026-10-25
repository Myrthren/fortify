import { chargeForResult, validSourcedLeads, InsufficientCredits } from "@/lib/result-credits";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import { braveSearch } from "@/lib/brave";
import { claude, CLAUDE_MODELS } from "@/lib/claude";

export type ScoredLead = {
  company: string;
  website: string;
  fitScore: number; // 1-10
  fitReason: string;
  hook: string; // personalized first line for outreach
};

/**
 * POST /api/leads/source
 * Body: { icp: string, location?: string, signal?: string }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (!TIER_LIMITS[user.tier].leadSourcing) {
    return NextResponse.json(
      { error: "Lead Sourcing is a Pro+ feature.", upgrade: true },
      { status: 403 }
    );
  }

  // Check credits
  if (user.credits < 50) {
    return NextResponse.json(
      { error: "Lead sourcing costs 50 credits. You don't have enough credits.", upgrade: true },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const icp: string = (typeof body.icp === "string" ? body.icp : "").trim();
  const location: string = (typeof body.location === "string" ? body.location : "").trim();
  const signal: string = (typeof body.signal === "string" ? body.signal : "").trim();

  if (!icp || icp.length < 5) {
    return NextResponse.json({ error: "Describe your ideal prospect (min 5 chars)." }, { status: 400 });
  }

  const query = [icp, location, signal, "company"].filter(Boolean).join(" ");

  try {
    const results = await braveSearch({ query, count: 15 });

    if (!results.length) {
      return NextResponse.json({ leads: [], creditsUsed: 0 });
    }

    const resultList = results
      .map((r, i) => `${i + 1}. Title: "${r.title}" | URL: ${r.url} | Snippet: ${r.description}`)
      .join("\n");

    const msg = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are a B2B sales prospecting expert. The user is looking for leads matching this ideal customer profile (ICP): "${icp}"${location ? `, located in: ${location}` : ""}${signal ? `, with buying signal: ${signal}` : ""}.

Below are web search results. For each result that looks like a real company or person matching the ICP, output a scored lead entry. Skip irrelevant results (news articles, job boards, directories, etc.).

Search results:
${resultList}

Return ONLY a JSON array of up to 8 lead objects. Format:
[{
  "company": "company or person name",
  "website": "exact URL from results",
  "fitScore": 7,
  "fitReason": "one sentence on why they fit the ICP",
  "hook": "personalised opening line for cold outreach referencing something specific about them"
}]`,
        },
      ],
    });

    const raw = msg.content.filter(b => b.type === "text").map(b => (b as { text: string }).text).join("\n");
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ leads: [], creditsUsed: 0 });

    const leads: ScoredLead[] = validSourcedLeads(JSON.parse(jsonMatch[0]), results);
    if (!leads.length) return NextResponse.json({ leads: [], creditsUsed: 0 });

    await chargeForResult(userId, 50, "spend_leads", async tx => tx.generation.create({
      data: { userId, type: "lead-sourcing", input: query, output: JSON.stringify(leads) },
    }));

    return NextResponse.json({ leads, creditsUsed: 50 });
  } catch (e: any) {
    if (e instanceof InsufficientCredits) return NextResponse.json({ error: e.message }, { status: 402 });
    console.error("[leads/source]", e);
    return new NextResponse(`Failed: ${e.message}`, { status: 500 });
  }
}
