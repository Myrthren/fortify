import Anthropic from "@anthropic-ai/sdk";
import { canFallback } from "@/lib/ai-fallback";
import { groqConfigured, groqMessage } from "@/lib/groq";

let _client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey && !groqConfigured()) throw new Error("No text-generation provider is configured");
    const primary = apiKey ? new Anthropic({ apiKey, maxRetries: 0, timeout: 20_000 }) : null;
    _client = { messages: { create: async (params: any, options?: { signal?: AbortSignal | null }) => {
      if (options?.signal?.aborted) throw new Error("Generation cancelled");
      if (!primary) return groqMessage(params, options);
      try { return await primary.messages.create(params, options as any); }
      catch (error) {
        if (options?.signal?.aborted || !groqConfigured() || !canFallback(error)) throw error;
        return groqMessage(params, options);
      }
    } } } as unknown as Anthropic;
  }
  return _client;
}

export const CLAUDE_MODELS = {
  fast: "claude-sonnet-4-6",
  premium: "claude-opus-4-7",
} as const;
