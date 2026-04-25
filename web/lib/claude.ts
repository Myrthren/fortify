import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const CLAUDE_MODELS = {
  fast: "claude-sonnet-4-5",
  premium: "claude-opus-4-5",
} as const;
