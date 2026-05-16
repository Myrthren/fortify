import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { getOrCreateSession, deductCost, estimateCost } from "@/lib/ai-usage";

const FORTIFY_KNOWLEDGE = `You are Fortify AI — the built-in AI assistant for Fortify, a business automation and scaling platform. You know everything about Fortify's features:

- Brand Voice Studio: Train AI on writing samples to generate content in the user's style
- Cold Outreach Generator: Personalised outreach messages for Twitter DMs, LinkedIn, Email
- Funnel Auditor: AI-powered landing page analysis with scores and fix recommendations
- Competitor Scanner: Deep intel reports on rival companies (website, YouTube, TikTok, Instagram, Twitter, SERP, Meta Ads)
- Trend Radar: Track topics across web and Reddit with freshness filters
- Lead Sourcing: Find and score prospects (costs 50 credits per search)
- Content Inspiration: Mine Reddit and YouTube for content angles
- Meta Ads: Real campaign performance dashboard + competitor ad intelligence
- Shopify: Revenue tracking, order analysis, product performance, automated low-stock Discord alerts
- Revenue (Stripe): MRR tracking, subscription analytics, churn monitoring
- Analytics: GA4, Search Console integration (coming soon)
- Virality Engine: AI video scoring (Elite/Apex), manual publish (Elite), auto-publish at optimal time (Apex). Supports YouTube and Facebook.
- Company DNA: Business memory system — tell Fortify about your company and it'll remember context
- Fortify AI: This chat system — powered by Claude, uses Company DNA for personalised responses
- Notion Integration: Export reports to Notion (coming soon)
- Discord Automations: Low stock alerts, weekly revenue, milestones, MRR changes, content briefs
- Forums: Community discussion boards
- Member Directory: Find other founders and operators
- Matchmaking: AI-suggested connections based on profile
- Deal Board: Post and browse community deals
- Mastermind Pods: Apex accountability circles

Tier system:
- Free: Very limited access
- Pro: £29/mo — core tools, 500 credits/mo, 10 trend terms, 1 brand voice
- Elite: £79/mo — everything + virality engine, unlimited audits/outreach, 3 brand voices, 1500 credits/mo
- Apex: £199/mo — everything unlimited + auto-publish, 5000 credits/mo

You have access to this user's Company DNA (their business context) in the system prompt. Use it to give personalised, relevant advice. Be direct, practical, and business-focused. Don't be sycophantic.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (user.tier === "FREE") {
    return NextResponse.json({ error: "Fortify AI requires a Pro, Elite, or Apex plan." }, { status: 403 });
  }

  const { session: aiSession, overLimit } = await getOrCreateSession(userId, user.tier);
  if (overLimit) {
    return NextResponse.json({ error: "SESSION_LIMIT_REACHED" }, { status: 429 });
  }

  // Parse multipart or JSON
  let messages: { role: "user" | "assistant"; content: any }[] = [];
  let hasImage = false;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const historyRaw = formData.get("history") as string;
    const messageText = formData.get("message") as string;
    const file = formData.get("file") as File | null;

    messages = historyRaw ? JSON.parse(historyRaw) : [];

    const userContent: any[] = [{ type: "text", text: messageText }];

    if (file) {
      if (file.type.startsWith("image/")) {
        hasImage = true;
        const bytes = await file.arrayBuffer();
        const b64 = Buffer.from(bytes).toString("base64");
        userContent.push({
          type: "image",
          source: { type: "base64", media_type: file.type as any, data: b64 },
        });
      } else {
        // txt / pdf — read as text
        const text = await file.text();
        userContent.push({ type: "text", text: `\n\n[Attached file: ${file.name}]\n${text.slice(0, 10000)}` });
      }
    }

    messages.push({ role: "user", content: userContent });
  } else {
    const body = await req.json();
    messages = body.messages ?? [];
  }

  // Load Company DNA
  const dna = await db.companyDna.findUnique({ where: { userId } });
  let dnaContext = "";
  if (dna && Array.isArray(dna.entries) && (dna.entries as any[]).length > 0) {
    dnaContext = "\n\n## Company DNA (user's business context):\n" +
      (dna.entries as any[]).map((e: any) => `**${e.label}**: ${e.content}`).join("\n");
  }

  const systemPrompt = FORTIFY_KNOWLEDGE + dnaContext;

  const response = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1500,
    system: systemPrompt,
    messages,
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("\n");

  const cost = estimateCost(
    response.usage.input_tokens,
    response.usage.output_tokens,
    hasImage
  );

  if (aiSession) {
    await deductCost(userId, user.tier, cost);
  }

  return NextResponse.json({ message: text, costGbp: cost });
}
