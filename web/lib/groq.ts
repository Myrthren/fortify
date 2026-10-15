import OpenAI from "openai";

let client: OpenAI | undefined;

export function groqConfigured(): boolean { return Boolean(process.env.GROQ_API_KEY?.trim()); }

function getClient(): OpenAI {
  if (!client) {
    if (!groqConfigured()) throw new Error("Groq fallback is not configured");
    client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1", maxRetries: 0, timeout: 25_000 });
  }
  return client;
}

function blockText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) throw new Error("Groq fallback requires text content");
  return value.map((b: any) => {
    if (b?.type !== "text" || typeof b.text !== "string") throw new Error("Groq fallback supports text only; image requests require an available vision provider");
    return b.text;
  }).join("\n\n");
}

function messagesForGroq(params: any): any[] {
  const messages: any[] = [];
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
  messages.push({ role: "system", content: (params.system ? blockText(params.system) + "\n\n" : "") + `Provider metadata: this response is served by Groq using ${model}. Do not claim to be Claude or an Anthropic model, even if older context says so. Preserve all task facts, style and safety constraints.` });
  for (const message of params.messages ?? []) {
    if (!["user", "assistant"].includes(message.role)) throw new Error("Unsupported message role for Groq fallback");
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) throw new Error("Invalid message content for Groq fallback");
    let text: string[] = [], toolCalls: any[] = [];
    const flush = () => { if (text.length) { messages.push({ role: message.role, content: text.join("\n") }); text = []; } };
    for (const block of message.content) {
      if (block.type === "text") text.push(blockText([block]));
      else if (message.role === "assistant" && block.type === "tool_use") {
        toolCalls.push({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input) } });
      } else if (message.role === "user" && block.type === "tool_result") {
        flush();
        messages.push({ role: "tool", tool_call_id: block.tool_use_id, content: blockText(block.content) });
      } else throw new Error("Groq fallback supports text and tool messages only; images are not supported");
    }
    if (toolCalls.length) messages.push({ role: "assistant", content: text.join("\n") || null, tool_calls: toolCalls });
    else flush();
  }
  return messages;
}

/** Adapt non-streaming Anthropic Messages calls, preserving voice and tool context. */
export async function groqMessage(params: any, options?: { signal?: AbortSignal | null }): Promise<any> {
  if (params.stream || params.thinking) throw new Error("This Groq fallback supports non-streaming text and tool requests only");
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
  const reasoning = model.startsWith("openai/gpt-oss");
  const messages = messagesForGroq(params); // Validate every block before transmitting anything.
  const tools = params.tools?.map((tool: any) => {
    if (!tool.name || !tool.input_schema || tool.type) throw new Error("Unsupported tool for Groq fallback");
    return { type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } };
  });
  const choice = params.tool_choice;
  const toolChoice = choice?.type === "tool" ? { type: "function", function: { name: choice.name } }
    : choice?.type === "any" ? "required" : choice?.type === "none" ? "none" : "auto";
  const result = await getClient().chat.completions.create({
    model, messages,
    max_completion_tokens: Math.min((params.max_tokens ?? 1024) + (reasoning ? 1024 : 0), 32768),
    ...(reasoning ? { reasoning_effort: "low" } : {}),
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params.stop_sequences ? { stop: params.stop_sequences } : {}),
    ...(tools?.length ? { tools, tool_choice: toolChoice } : {}),
  } as any, { signal: options?.signal });
  const first = result.choices[0];
  if (!first || !["stop", "length", "tool_calls"].includes(first.finish_reason)) throw new Error("Groq returned no usable completion");
  if (first.finish_reason === "length" && first.message.tool_calls?.length) throw new Error("Groq returned a truncated tool call");
  const content: any[] = [];
  if (first.message.content) content.push({ type: "text", text: first.message.content });
  for (const call of first.message.tool_calls ?? []) {
    if (!params.tools?.some((tool: any) => tool.name === call.function.name)) throw new Error("Groq returned an unknown tool");
    let input: unknown;
    try { input = JSON.parse(call.function.arguments); } catch { throw new Error("Groq returned invalid tool arguments"); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Groq returned invalid tool arguments");
    content.push({ type: "tool_use", id: call.id, name: call.function.name, input });
  }
  if (!content.length) throw new Error("Groq returned an empty completion");
  return { id: result.id, type: "message", role: "assistant", model, content,
    stop_reason: first.finish_reason === "length" ? "max_tokens" : content.some(b => b.type === "tool_use") ? "tool_use" : "end_turn",
    stop_sequence: null, usage: { input_tokens: result.usage?.prompt_tokens ?? 0, output_tokens: result.usage?.completion_tokens ?? 0 } };
}
