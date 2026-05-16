import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { getOrCreateSession, deductCost, estimateCost } from "@/lib/ai-usage";
import { randomUUID } from "crypto";

// ── Workflow node types (kept in sync with workflow-editor.tsx) ───────────────
const WF_NODE_TYPES = [
  "trigger_schedule","trigger_webhook","trigger_new_member","trigger_competitor","trigger_lead",
  "ai_generate","ai_summarise","ai_analyse","ai_classify",
  "action_discord","action_email","action_slack","action_notion","action_twitter","action_shopify","action_webhook_out",
  "logic_condition","logic_delay","logic_filter",
].join(", ");

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
  {
    name: "create_workflow",
    description:
      "Create a fully configured automation workflow for the user. Use this when they describe an automation they want — build all the nodes with real config values and the connections between them. Requires Elite or Apex tier.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short descriptive workflow name" },
        description: { type: "string", description: "One sentence explaining what this workflow does" },
        nodes: {
          type: "array",
          description: "Workflow nodes. Each needs realistic config values based on what the user described.",
          items: {
            type: "object",
            properties: {
              id:     { type: "string", description: "Unique short ID, e.g. n1, n2, n3" },
              type:   { type: "string", description: `One of: ${WF_NODE_TYPES}` },
              label:  { type: "string", description: "Human-readable node label" },
              x:      { type: "number", description: "Canvas X position (space nodes 180px apart vertically)" },
              y:      { type: "number", description: "Canvas Y position. Start at y:160, increment by 180 per step." },
              config: { type: "object", description: "Node-specific config. For ai_generate: set prompt, outputVar, model. For action_discord: set channel (leave blank if unknown), message. Fill in sensible defaults based on context." },
            },
            required: ["id", "type", "label", "x", "y", "config"],
          },
        },
        connections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id:       { type: "string" },
              fromId:   { type: "string" },
              fromPort: { type: "string", enum: ["out", "yes", "no"] },
              toId:     { type: "string" },
            },
            required: ["id", "fromId", "fromPort", "toId"],
          },
        },
      },
      required: ["name", "description", "nodes", "connections"],
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

async function execCreateWorkflow(
  userId: string,
  tier: string,
  name: string,
  description: string,
  nodes: any[],
  connections: any[]
): Promise<{ success: boolean; description: string; workflowId?: string }> {
  try {
    if (!["ELITE", "APEX"].includes(tier)) {
      return { success: false, description: "Workflows require Elite or Apex tier." };
    }
    const wf = await db.workflow.create({
      data: {
        userId,
        name: name.trim().slice(0, 100),
        description: description?.trim().slice(0, 500),
        nodes: { nodes, connections },
        active: false,
      },
    });
    return { success: true, description: `Workflow "${name}" created successfully.`, workflowId: wf.id };
  } catch (e: any) {
    return { success: false, description: e.message ?? "Workflow creation failed" };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const FORTIFY_KNOWLEDGE = `You are Fortify AI — the built-in AI assistant and agent for Fortify, a business scaling platform. You can hold conversations AND perform actions directly inside Fortify when asked.

## Actions you can perform right now:
- **update_profile** — change the user's niche, skills, looking for, can offer, or social links
- **update_settings** — change username or privacy toggles (allow messages, allow connections, show Discord username)
- **add_company_dna** — save important business context to persistent memory
- **create_workflow** — build a full automation workflow with nodes and connections from scratch (Elite/Apex only). Use this when the user describes an automation they want — do it immediately, don't just explain how.

If a user asks you to change something about their account or build a workflow, USE THE TOOL — don't just explain how. Do it immediately and confirm what you did.

## When referencing Fortify pages, use clickable markdown links:
[Brand Voice](/dashboard/voice) · [Outreach](/dashboard/outreach) · [Funnel Audit](/dashboard/audit) · [Trend Radar](/dashboard/trends) · [Competitors](/dashboard/competitors) · [Lead Sourcing](/dashboard/leads) · [Inspiration](/dashboard/inspiration) · [Meta Ads](/dashboard/ads) · [Shopify](/dashboard/shopify) · [Revenue](/dashboard/revenue) · [Virality Engine](/dashboard/virality) · [Company DNA](/dashboard/company-dna) · [Matchmaking](/dashboard/matchmaking) · [Members](/dashboard/members) · [Forums](/dashboard/forums) · [Messages](/dashboard/messages) · [Connections](/dashboard/connections) · [Profile](/dashboard/profile) · [Settings](/dashboard/settings) · [Credits](/dashboard/credits) · [Recon](/dashboard/recon) · [Competitor Watch](/dashboard/competitor-tracking) · [Workflows](/dashboard/workflows)

## Complete Fortify feature list (all current):
- **Brand Voice Studio** — Train AI on writing samples, generate content in your style
- **Cold Outreach** — Personalised DMs for Twitter, LinkedIn, Email
- **Funnel Auditor** — AI landing page scores + fix recommendations
- **Competitor Scanner** — Deep intel (website, YouTube, TikTok, Instagram, Twitter, SERP, Meta Ads)
- **Trend Radar** — Track topics across web + Reddit (Pro: 10 terms, Elite/Apex: unlimited)
- **Lead Sourcing** — Find and score prospects against your ICP (50 credits/search)
- **Content Inspiration** — Mine Reddit + YouTube for content angles
- **Meta Ads** — Live campaign stats + competitor ad intel
- **Shopify Integration** — Revenue, orders, products, automated Discord alerts, low-stock notifications
- **Revenue (Stripe)** — MRR, subscriptions, churn monitoring
- **Virality Engine** — AI video scoring + optimal-time social publishing (Elite/Apex)
- **Company DNA** — Persistent business memory for personalised AI responses (Pro+)
- **Fortify Recon** — Find local businesses by location and category for B2B lead gen (Elite/Apex, 50 credits/search). Results include name, address, phone, website.
- **Competitor Watch** — Monitor competitor web pages for content changes. Tracks MD5 hashes of pages, alerts you via dashboard notification + Discord DM when content changes. 25 credits to create a watch, 10 credits per scan. Runs daily automatically for Elite/Apex users.
- **Workflows** — Visual drag-and-drop automation builder. Create multi-step automations with: Trigger nodes (Schedule, Webhook, New Member, Competitor Change, New Lead), AI nodes (Generate, Summarise, Analyse, Classify), Action nodes (Discord Post, Email, Slack, Notion, Twitter/X, Shopify, Webhook Out), and Logic nodes (Condition, Delay, Filter). Nodes connect with bezier string connections. Each node has detailed config. Capacity packs: 5,000 units for £9.99, 12,000 units for £19.99.
- **Analytics** — GA4, Search Console, YouTube (coming soon)
- **Forums** — Community discussion boards
- **Member Directory** — Find founders and operators
- **AI Matchmaking** — Top members worth talking to based on your profile
- **Deal Board** — Post and browse community deals (hiring, collab, opportunities)
- **Mastermind Pods** — Accountability circles (Apex)
- **Messages** — Chat with other Fortify members
- **Connections** — LinkedIn-style network of Fortify members

## Tiers:
- **Free** — Hook Generator, limited access
- **Pro (£29/mo)** — Core tools, 500 credits/mo
- **Elite (£79/mo)** — Everything + Virality Engine + Recon + Competitor Watch + Workflows, 1,500 credits/mo
- **Apex (£199/mo)** — Everything unlimited + auto-publish + Mastermind Pods, 5,000 credits/mo

## Workflow node types and their key config fields:
- **trigger_schedule**: cron (expression), timezone
- **trigger_webhook**: method (GET/POST), secret
- **trigger_new_member**: tier (filter: PRO/ELITE/APEX/any)
- **trigger_competitor**: watchName
- **trigger_lead**: minScore
- **ai_generate**: prompt, outputVar, model (haiku/sonnet), maxTokens
- **ai_summarise**: input, maxLength, outputVar
- **ai_analyse**: input, criteria, outputVar
- **ai_classify**: input, categories, outputVar
- **action_discord**: channel (Discord channel ID), message (supports {{variables}}), embedTitle, embedColor, username
- **action_email**: to, subject, body, fromName
- **action_slack**: webhookUrl, message, username, emoji
- **action_notion**: database (ID), title, content, properties (JSON)
- **action_twitter**: message, replyTo
- **action_shopify**: action (tag_customer/add_note/create_draft/send_webhook), value, customerId
- **action_webhook_out**: url, method, headers (JSON), body (JSON template)
- **logic_condition**: leftSide ({{var}}), operator (==, !=, >, <, >=, <=, contains, not_contains), rightSide — has YES and NO output ports
- **logic_delay**: duration, unit (minutes/hours/days)
- **logic_filter**: expression ({{var}} > 100 AND ...)

## Template variables available in node configs:
{{member.name}}, {{member.email}}, {{member.tier}}, {{member.credits}}, {{previous_output}}, {{generated_text}} (or any custom outputVar name from an ai_generate node), {{date}}

Be direct and practical. Use markdown for structure when it helps. When you've performed an action or created a workflow, briefly confirm it. After creating a workflow, include a link: [Open workflow](/dashboard/workflows/WORKFLOW_ID).`;

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
      } else if (block.name === "create_workflow") {
        result = await execCreateWorkflow(
          userId, user.tier,
          block.input.name, block.input.description,
          block.input.nodes ?? [], block.input.connections ?? []
        );
      } else {
        result = { success: false, description: `Unknown tool: ${block.name}` };
      }

      actionResults.push(result);
      // For create_workflow, pass the workflowId so Claude can embed the link in its reply
      const toolContent = result.success
        ? `Success: ${result.description}${(result as any).workflowId ? ` workflowId=${(result as any).workflowId}` : ""}`
        : `Error: ${result.description}`;
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: toolContent,
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
