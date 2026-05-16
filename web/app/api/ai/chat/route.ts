import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { getOrCreateSession, deductCost, estimateCost } from "@/lib/ai-usage";
import { randomUUID } from "crypto";

// ── Tool definitions ──────────────────────────────────────────────────────────

const FORTIFY_TOOLS: any[] = [
  {
    name: "update_profile",
    description:
      "Update a field on the user's Fortify profile. Use this when they ask to change their niche, bio, skills, looking for, can offer, or social links. Do it immediately — don't just explain how.",
    input_schema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: [
            "niche", "skills", "lookingFor", "canOffer",
            "social_twitter", "social_instagram", "social_tiktok",
            "social_youtube", "social_linkedin",
          ],
          description: "The profile field to update",
        },
        value: {
          type: "string",
          description:
            "New value. For array fields (skills, lookingFor, canOffer) use comma-separated values.",
        },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "update_settings",
    description:
      "Update user account settings: username or a privacy toggle. Do this immediately when asked.",
    input_schema: {
      type: "object",
      properties: {
        setting: {
          type: "string",
          enum: ["username", "allowMessages", "allowConnections", "showDiscordUsername"],
        },
        value: {
          type: "string",
          description:
            "For username: the new username string. For boolean settings: 'true' or 'false'.",
        },
      },
      required: ["setting", "value"],
    },
  },
  {
    name: "add_company_dna",
    description:
      "Save a piece of business context to the user's Company DNA memory so it's remembered across all future conversations. Use this when the user shares something important about their business they want remembered.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Short label, e.g. 'Target Audience'" },
        content: { type: "string", description: "The information to save" },
      },
      required: ["label", "content"],
    },
  },
];

// ── Tool executors ────────────────────────────────────────────────────────────

async function execUpdateProfile(
  userId: string,
  field: string,
  value: string
): Promise<{ success: boolean; description: string }> {
  try {
    await db.profile.upsert({ where: { userId }, create: { userId }, update: {} });

    if (field === "niche") {
      await db.profile.update({ where: { userId }, data: { niche: value.trim().slice(0, 100) } });
      return { success: true, description: `Niche set to "${value.trim()}"` };
    }
    if (field === "skills") {
      const arr = value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
      await db.profile.update({ where: { userId }, data: { skills: arr } });
      return { success: true, description: `Skills set: ${arr.slice(0, 4).join(", ")}${arr.length > 4 ? "…" : ""}` };
    }
    if (field === "lookingFor") {
      const arr = value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
      await db.profile.update({ where: { userId }, data: { lookingFor: arr } });
      return { success: true, description: `Looking for: ${arr.join(", ")}` };
    }
    if (field === "canOffer") {
      const arr = value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
      await db.profile.update({ where: { userId }, data: { canOffer: arr } });
      return { success: true, description: `Can offer: ${arr.join(", ")}` };
    }
    if (field.startsWith("social_")) {
      const platform = field.replace("social_", "");
      const existing = await db.profile.findUnique({ where: { userId } });
      const current = (existing?.socials as Record<string, string>) ?? {};
      await db.profile.update({
        where: { userId },
        data: { socials: { ...current, [platform]: value.trim() } },
      });
      return { success: true, description: `${platform} link updated` };
    }
    return { success: false, description: `Unknown field: ${field}` };
  } catch (e: any) {
    return { success: false, description: e.message ?? "Update failed" };
  }
}

async function execUpdateSettings(
  userId: string,
  setting: string,
  value: string,
  user: any
): Promise<{ success: boolean; description: string }> {
  try {
    if (setting === "username") {
      const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (cleaned.length < 3 || cleaned.length > 20)
        return { success: false, description: "Username must be 3–20 characters (a–z, 0–9, _)" };
      const taken = await db.user.findFirst({
        where: { username: cleaned, NOT: { id: userId } },
      });
      if (taken) return { success: false, description: `@${cleaned} is already taken` };
      const isFree = !user.username || user.usernameChangesUsed === 0;
      if (!isFree && user.credits < 1000)
        return {
          success: false,
          description: `Need 1000 credits to change username (you have ${user.credits})`,
        };
      await db.user.update({
        where: { id: userId },
        data: {
          username: cleaned,
          usernameChangesUsed: { increment: 1 },
          ...(!isFree ? { credits: { decrement: 1000 } } : {}),
        },
      });
      return {
        success: true,
        description: `Username set to @${cleaned}${isFree ? "" : " (1,000 credits deducted)"}`,
      };
    }
    if (["allowMessages", "allowConnections", "showDiscordUsername"].includes(setting)) {
      const boolVal = ["true", "yes", "on", "enable", "enabled"].includes(value.toLowerCase());
      await db.user.update({ where: { id: userId }, data: { [setting]: boolVal } });
      const labels: Record<string, [string, string]> = {
        allowMessages:       ["Message requests enabled",          "Message requests disabled"],
        allowConnections:    ["Connection requests enabled",        "Connection requests disabled"],
        showDiscordUsername: ["Discord username visible in search", "Discord username hidden from search"],
      };
      const [on, off] = labels[setting] ?? [`${setting} on`, `${setting} off`];
      return { success: true, description: boolVal ? on : off };
    }
    return { success: false, description: `Unknown setting: ${setting}` };
  } catch (e: any) {
    return { success: false, description: e.message ?? "Settings update failed" };
  }
}

async function execAddDna(
  userId: string,
  tier: string,
  label: string,
  content: string
): Promise<{ success: boolean; description: string }> {
  try {
    const LIMITS: Record<string, number> = {
      FREE: 0, PRO: 30000, ELITE: 100000, APEX: 999999,
    };
    const limit = LIMITS[tier] ?? 0;
    if (!limit) return { success: false, description: "Company DNA requires Pro+" };
    const dna = await db.companyDna.findUnique({ where: { userId } });
    const entries = (dna?.entries as any[]) ?? [];
    const chars = (label + content).length;
    if ((dna?.totalChars ?? 0) + chars > limit)
      return { success: false, description: "Memory limit reached — free up space in Company DNA first" };
    const newEntry = {
      id: randomUUID(),
      label: label.trim(),
      content: content.trim(),
      chars,
      createdAt: new Date().toISOString(),
    };
    await db.companyDna.upsert({
      where: { userId },
      create: { userId, entries: [...entries, newEntry], totalChars: (dna?.totalChars ?? 0) + chars },
      update: { entries: [...entries, newEntry], totalChars: { increment: chars } },
    });
    return { success: true, description: `"${label}" saved to Company DNA` };
  } catch (e: any) {
    return { success: false, description: e.message ?? "DNA save failed" };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const FORTIFY_KNOWLEDGE = `You are Fortify AI — the built-in AI assistant and agent for Fortify, a business scaling platform. You can hold conversations AND perform actions directly inside Fortify when asked.

## Actions you can perform right now:
- update_profile: change the user's niche, skills, looking for, can offer, or social links
- update_settings: change username or privacy toggles (allow messages, allow connections, show Discord username)
- add_company_dna: save important business context to persistent memory

If a user asks you to change something about their account, USE THE TOOL — don't just explain how. Do it immediately and confirm what you did.

## When referencing Fortify pages, use clickable markdown links:
[Brand Voice](/dashboard/voice) · [Outreach](/dashboard/outreach) · [Funnel Audit](/dashboard/audit) · [Trend Radar](/dashboard/trends) · [Competitors](/dashboard/competitors) · [Lead Sourcing](/dashboard/leads) · [Inspiration](/dashboard/inspiration) · [Meta Ads](/dashboard/ads) · [Shopify](/dashboard/shopify) · [Revenue](/dashboard/revenue) · [Virality Engine](/dashboard/virality) · [Company DNA](/dashboard/company-dna) · [Matchmaking](/dashboard/matchmaking) · [Members](/dashboard/members) · [Forums](/dashboard/forums) · [Messages](/dashboard/messages) · [Connections](/dashboard/connections) · [Profile](/dashboard/profile) · [Settings](/dashboard/settings) · [Credits](/dashboard/credits)

## Fortify features:
- Brand Voice Studio: Train AI on writing samples, generate content in the user's style
- Outreach Generator: Personalised cold DMs for Twitter, LinkedIn, Email
- Funnel Auditor: AI-powered landing page analysis with scores and fix recommendations
- Competitor Scanner: Deep intel reports on rivals (website, YouTube, TikTok, Instagram, Twitter, SERP, Meta Ads)
- Trend Radar: Track topics across web + Reddit (Pro: 10 terms, Elite/Apex: unlimited)
- Lead Sourcing: Find and score prospects — 50 credits per search
- Content Inspiration: Mine Reddit + YouTube for content angles
- Meta Ads: Live campaign stats + competitor ad intelligence
- Shopify: Revenue, orders, products, automated Discord alerts
- Revenue (Stripe): MRR, subscriptions, churn monitoring
- Virality Engine: AI video scoring + optimal-time publishing (Elite/Apex)
- Company DNA: Business memory for personalised AI responses
- Forums: Community discussion boards
- Member Directory: Find other founders and operators
- Matchmaking: AI-matched connections based on profile
- Deal Board: Community deals and opportunities

## Tiers:
- Free: Limited access
- Pro: £29/mo — core tools, 500 credits/mo
- Elite: £79/mo — everything + virality, unlimited usage, 1500 credits/mo
- Apex: £199/mo — everything unlimited + auto-publish, 5000 credits/mo

Be direct and practical. Use markdown for structure when it helps. When you've performed an action, briefly confirm it in plain terms.`;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return new NextResponse("Not found", { status: 404 });

  if (user.tier === "FREE") {
    return NextResponse.json(
      { error: "Fortify AI requires a Pro, Elite, or Apex plan." },
      { status: 403 }
    );
  }

  const { session: aiSession, overLimit } = await getOrCreateSession(userId, user.tier);
  if (overLimit) {
    return NextResponse.json({ error: "SESSION_LIMIT_REACHED" }, { status: 429 });
  }

  // ── Parse multipart or JSON ──
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
        userContent.push({
          type: "image",
          source: { type: "base64", media_type: file.type, data: Buffer.from(bytes).toString("base64") },
        });
      } else {
        const text = await file.text();
        userContent.push({
          type: "text",
          text: `\n\n[Attached file: ${file.name}]\n${text.slice(0, 10000)}`,
        });
      }
    }
    messages.push({ role: "user", content: userContent });
  } else {
    const body = await req.json();
    messages = body.messages ?? [];
  }

  // ── Inject Company DNA ──
  const dna = await db.companyDna.findUnique({ where: { userId } });
  let dnaContext = "";
  if (dna && Array.isArray(dna.entries) && (dna.entries as any[]).length > 0) {
    dnaContext =
      "\n\n## This user's Company DNA (their business context — use it for personalised responses):\n" +
      (dna.entries as any[]).map((e: any) => `**${e.label}**: ${e.content}`).join("\n");
  }

  // ── Inject past chat memory ──
  let memoryContext = "";
  const pastSessions = await db.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 5, // last 5 sessions for context
    select: { title: true, messages: true, createdAt: true },
  });
  if (pastSessions.length > 0) {
    memoryContext = "\n\n## Your memory from past conversations with this user:\n";
    for (const s of pastSessions.reverse()) { // oldest first
      const msgs = s.messages as any[];
      // Take first user message and last assistant message as summary
      const firstUser = msgs.find((m) => m.role === "user")?.content?.slice(0, 200) ?? "";
      const lastAssist = [...msgs].reverse().find((m) => m.role === "assistant")?.content?.slice(0, 300) ?? "";
      if (firstUser || lastAssist) {
        memoryContext += `\n**Session: "${s.title}"** (${new Date(s.createdAt).toLocaleDateString()})\n`;
        if (firstUser) memoryContext += `User asked: ${firstUser}\n`;
        if (lastAssist) memoryContext += `You replied: ${lastAssist}\n`;
      }
    }
  }
  const systemPrompt = FORTIFY_KNOWLEDGE + dnaContext + memoryContext;

  // ── First Claude call (may use tools) ──
  const resp1 = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 2000,
    system: systemPrompt,
    tools: FORTIFY_TOOLS,
    messages,
  } as any);

  let totalIn  = resp1.usage.input_tokens;
  let totalOut = resp1.usage.output_tokens;
  const actionResults: { description: string; success: boolean }[] = [];
  let finalText = "";

  if ((resp1 as any).stop_reason === "tool_use") {
    // ── Execute each tool ──
    const toolUseBlocks = (resp1.content as any[]).filter((b) => b.type === "tool_use");
    const toolResults: any[] = [];

    for (const block of toolUseBlocks) {
      const input = block.input as Record<string, string>;
      let result: { success: boolean; description: string };

      if (block.name === "update_profile") {
        result = await execUpdateProfile(userId, input.field, input.value);
      } else if (block.name === "update_settings") {
        result = await execUpdateSettings(userId, block.input.setting, block.input.value, user);
      } else if (block.name === "add_company_dna") {
        result = await execAddDna(userId, user.tier, block.input.label, block.input.content);
      } else {
        result = { success: false, description: `Unknown tool: ${block.name}` };
      }

      actionResults.push(result);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.success ? `Success: ${result.description}` : `Error: ${result.description}`,
      });
    }

    // ── Second Claude call with tool results ──
    const resp2 = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 1500,
      system: systemPrompt,
      tools: FORTIFY_TOOLS,
      messages: [
        ...messages,
        { role: "assistant", content: resp1.content },
        { role: "user",      content: toolResults },
      ],
    } as any);

    totalIn  += resp2.usage.input_tokens;
    totalOut += resp2.usage.output_tokens;

    finalText = (resp2.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } else {
    finalText = (resp1.content as any[])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }

  const cost = estimateCost(totalIn, totalOut, hasImage);
  if (aiSession) await deductCost(userId, user.tier, cost);

  return NextResponse.json({ message: finalText, actions: actionResults, costGbp: cost });
}
