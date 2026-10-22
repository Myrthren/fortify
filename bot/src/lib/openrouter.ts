import OpenAI from "openai";

let client: OpenAI | undefined;

export function openrouterConfigured(): boolean { return Boolean(process.env.OPENROUTER_API_KEY?.trim()); }

function getClient(): OpenAI {
  if (!client) {
    if (!openrouterConfigured()) throw new Error("OpenRouter fallback is not configured");
    client = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1", maxRetries: 0, timeout: 25_000, defaultHeaders: { "HTTP-Referer": "https://fortify-io.com", "X-OpenRouter-Title": "Fortify" } });
  }
  return client;
}

function blockText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) throw new Error("OpenRouter fallback requires text content");
  return value.map((b: any) => {
    if (b?.type !== "text" || typeof b.text !== "string") throw new Error("OpenRouter fallback supports text only; image requests require an available vision provider");
    return b.text;
  }).join("\n\n");
}

function messagesForOpenRouter(params: any, model: string): any[] {
  const messages: any[] = [];
  messages.push({ role: "system", content: (params.system ? blockText(params.system) + "\n\n" : "") + `Provider metadata: this response is served through OpenRouter using ${model}. Identify the selected model accurately. Preserve all task facts, style and safety constraints.` });
  for (const message of params.messages ?? []) {
    if (!["user", "assistant"].includes(message.role)) throw new Error("Unsupported message role for OpenRouter fallback");
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) throw new Error("Invalid message content for OpenRouter fallback");
    let parts: any[] = [], toolCalls: any[] = [];
    const content = () => parts.every(p => p.type === "text") ? parts.map(p => p.text).join("\n") : parts;
    const flush = () => { if (parts.length) { messages.push({ role: message.role, content: content() }); parts = []; } };
    for (const block of message.content) {
      if (block.type === "text") parts.push({ type: "text", text: blockText([block]) });
      else if (message.role === "user" && block.type === "image") {
        const source = block.source;
        if (source?.type !== "base64" || !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(source.media_type) || typeof source.data !== "string" || !source.data) throw new Error("Unsupported image attachment");
        parts.push({ type: "image_url", image_url: { url: `data:${source.media_type};base64,${source.data}` } });
      }
      else if (message.role === "assistant" && block.type === "tool_use") {
        toolCalls.push({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input) } });
      } else if (message.role === "user" && block.type === "tool_result") {
        flush();
        messages.push({ role: "tool", tool_call_id: block.tool_use_id, content: blockText(block.content) });
      } else throw new Error("OpenRouter fallback supports text and tool messages only; images are not supported");
    }
    if (toolCalls.length) messages.push({ role: "assistant", content: parts.length ? content() : null, tool_calls: toolCalls,
      ...(message.content[0]?.openrouterReasoning ? { reasoning_details: message.content[0].openrouterReasoning } : {}) });
    else flush();
  }
  return messages;
}

export function validateOpenrouterRequest(params: any, model: string) {
  if (params.stream || params.thinking) throw new Error("This OpenRouter adapter supports non-streaming requests without explicit thinking configuration");
  messagesForOpenRouter(params, model);
  if (params.tools !== undefined && !Array.isArray(params.tools)) throw new Error("Invalid tool definitions");
  for (const tool of params.tools ?? []) if (!tool.name || !tool.input_schema || tool.type) throw new Error("Unsupported tool for OpenRouter");
}

/** Adapt non-streaming Anthropic Messages calls, preserving voice and tool context. */
export async function openrouterMessage(params: any, options?: { signal?: AbortSignal | null; model?: string; onUsage?: (result: any) => Promise<void> }): Promise<any> {
  const model = options?.model || process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-oss-120b";
  validateOpenrouterRequest(params, model);
  const reasoning = model.startsWith("openai/gpt-oss");
  const messages = messagesForOpenRouter(params, model); // Validate every block before transmitting anything.
  const tools = params.tools?.map((tool: any) => {
    if (!tool.name || !tool.input_schema || tool.type) throw new Error("Unsupported tool for OpenRouter fallback");
    return { type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } };
  });
  const choice = params.tool_choice;
  const toolChoice = choice?.type === "tool" ? { type: "function", function: { name: choice.name } }
    : choice?.type === "any" ? "required" : choice?.type === "none" ? "none" : "auto";
  const result = await getClient().chat.completions.create({
    model, messages,
    max_tokens: Math.min((params.max_tokens ?? 1024) + (reasoning ? 1024 : 0), 32768),
    ...(reasoning ? { reasoning: { effort: "low" } } : {}),
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params.stop_sequences ? { stop: params.stop_sequences } : {}),
    ...(tools?.length ? { tools, tool_choice: toolChoice } : {}),
    provider: { require_parameters: true },
  } as any, { signal: options?.signal });
  if (options?.onUsage) await options.onUsage(result);
  const first = result.choices?.[0];
  if (!first || !["stop", "length", "tool_calls"].includes(first.finish_reason)) throw new Error("OpenRouter returned no usable completion");
  if (first.finish_reason === "length" && first.message.tool_calls?.length) throw new Error("OpenRouter returned a truncated tool call");
  const content: any[] = [];
  if (first.message.content) content.push({ type: "text", text: first.message.content });
  for (const call of first.message.tool_calls ?? []) {
    if (!params.tools?.some((tool: any) => tool.name === call.function.name)) throw new Error("OpenRouter returned an unknown tool");
    let input: unknown;
    try { input = JSON.parse(call.function.arguments); } catch { throw new Error("OpenRouter returned invalid tool arguments"); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("OpenRouter returned invalid tool arguments");
    content.push({ type: "tool_use", id: call.id, name: call.function.name, input });
  }
  if (!content.length) throw new Error("OpenRouter returned an empty completion");
  if ((first.message as any).reasoning_details) content[0].openrouterReasoning = (first.message as any).reasoning_details;
  return { id: result.id, type: "message", role: "assistant", model: result.model || model, content,
    stop_reason: first.finish_reason === "length" ? "max_tokens" : content.some(b => b.type === "tool_use") ? "tool_use" : "end_turn",
    stop_sequence: null, usage: { input_tokens: result.usage?.prompt_tokens ?? 0, output_tokens: result.usage?.completion_tokens ?? 0 } };
}
