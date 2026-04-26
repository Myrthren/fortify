import { claude, CLAUDE_MODELS } from "./claude";

export async function generateInVoice(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: opts.maxTokens ?? 1000,
    // SDK 0.32 doesn't type cache_control yet; the API accepts it.
    system: [
      {
        type: "text",
        text: opts.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ] as any,
    messages: [{ role: "user", content: opts.userPrompt }],
  });

  return res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();
}
