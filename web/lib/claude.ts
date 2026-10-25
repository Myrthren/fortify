import type Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { currentAiUserId } from "./ai-context";
import { AI_MODELS, routedAiMessage } from "./ai-router";

export const CLAUDE_MODELS = AI_MODELS;
/** Every call is bound to the authenticated member or an owned background job. */
export function claude(memberId?: string): Anthropic {
  return { messages: { create: async (params: any, options?: { signal?: AbortSignal | null }) => {
    const userId = memberId || currentAiUserId() || ((await auth())?.user as any)?.id;
    if (!userId) throw new Error("AI requests require a member account");
    return routedAiMessage(userId, params, options);
  } } } as unknown as Anthropic;
}
