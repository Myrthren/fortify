import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateHooks(topic: string, count = 5): Promise<string[]> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.9,
    messages: [
      {
        role: "system",
        content:
          "You write scroll-stopping short-form video hooks. Punchy, curious, under 12 words. No hashtags. No emojis. Return one hook per line, no numbering.",
      },
      { role: "user", content: `Topic: ${topic}\n\nWrite ${count} hooks.` },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "";
  return text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, count);
}
