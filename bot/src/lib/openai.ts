import { claude, CLAUDE_MODELS } from "./claude";

export async function generateHooks(topic: string, count = 5): Promise<string[]> {
  const result = await claude().messages.create({
    model: CLAUDE_MODELS.fast, max_tokens: 600,
    system: "You write scroll-stopping short-form video hooks. Punchy, curious, under 12 words. No hashtags. No emojis. Never invent statistics, percentages or results. Return one hook per line, no numbering.",
    messages: [{ role: "user", content: `Topic: ${topic}\n\nWrite ${count} hooks.` }],
  });
  return result.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").split("\n").map((line: string) => line.trim()).filter(Boolean).slice(0, count);
}
