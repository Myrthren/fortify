import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * AI client for the bot.
 *
 * When GROQ_API_KEY is set, calls are routed to Groq (OpenAI-compatible API)
 * through an adapter that accepts and returns Anthropic Messages shapes, so every
 * call site (`claude().messages.create(...)`, `res.content`, `stop_reason`,
 * tool_use / tool_result blocks) keeps working unchanged. Without GROQ_API_KEY
 * it falls back to Anthropic. The Claude model names callers pass are ignored on
 * Groq; GROQ_MODEL overrides the default Groq model.
 */

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

let _client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!_client) {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      _client = groqAdapter(new OpenAI({ apiKey: groqKey, baseURL: GROQ_BASE_URL }));
    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("Neither GROQ_API_KEY nor ANTHROPIC_API_KEY is set");
      _client = new Anthropic({ apiKey });
    }
  }
  return _client;
}

export const CLAUDE_MODELS = {
  fast: "claude-sonnet-4-6",
  premium: "claude-opus-4-7",
} as const;

// ── Groq adapter ───────────────────────────────────────────────────────────────

function systemText(system: unknown): string {
  if (typeof system === "string") return system;
  if (Array.isArray(system)) return system.map((b: any) => b?.text ?? "").join("\n\n");
  return "";
}

function toOpenAIMessages(system: unknown, messages: any[]): any[] {
  const out: any[] = [];
  const sys = systemText(system);
  if (sys) out.push({ role: "system", content: sys });

  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const blocks: any[] = Array.isArray(m.content) ? m.content : [];
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (m.role === "assistant") {
      const toolCalls = blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          type: "function",
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));
      out.push({
        role: "assistant",
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
    } else {
      // Tool results must come first, directly after the assistant tool_calls turn.
      for (const b of blocks) {
        if (b.type !== "tool_result") continue;
        out.push({
          role: "tool",
          tool_call_id: b.tool_use_id,
          content: typeof b.content === "string" ? b.content : JSON.stringify(b.content),
        });
      }
      if (text) out.push({ role: "user", content: text });
    }
  }
  return out;
}

function toOpenAITools(tools: any[] | undefined): any[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

function groqAdapter(openai: OpenAI): Anthropic {
  const model = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
  // gpt-oss models spend part of the token budget on reasoning; keep reasoning
  // light and add headroom so short max_tokens values still produce an answer.
  const isReasoning = model.startsWith("openai/gpt-oss");

  const create = async (params: any) => {
    const tools = toOpenAITools(params.tools);
    const res = await openai.chat.completions.create({
      model,
      messages: toOpenAIMessages(params.system, params.messages),
      max_completion_tokens: (params.max_tokens ?? 1024) + (isReasoning ? 1024 : 0),
      ...(isReasoning ? { reasoning_effort: "low" } : {}),
      ...(tools ? { tools } : {}),
    } as any);

    const choice = res.choices[0];
    const msg: any = choice?.message ?? {};
    const content: any[] = [];
    if (msg.content) content.push({ type: "text", text: msg.content });
    for (const tc of msg.tool_calls ?? []) {
      let input: unknown = {};
      try {
        input = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        // leave input empty; the tool handler will reject missing arguments
      }
      content.push({ type: "tool_use", id: tc.id, name: tc.function?.name, input });
    }

    const stop_reason =
      msg.tool_calls?.length ? "tool_use" : choice?.finish_reason === "length" ? "max_tokens" : "end_turn";

    return {
      id: res.id,
      type: "message",
      role: "assistant",
      model,
      content,
      stop_reason,
      stop_sequence: null,
      usage: {
        input_tokens: res.usage?.prompt_tokens ?? 0,
        output_tokens: res.usage?.completion_tokens ?? 0,
      },
    };
  };

  return { messages: { create } } as unknown as Anthropic;
}
