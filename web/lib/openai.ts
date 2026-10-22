import OpenAI from "openai";
import { canFallback } from "@/lib/ai-fallback";
import { groqConfigured, groqMessage } from "@/lib/groq";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export function openaiClient(): OpenAI {
  return client();
}

// Shared image generation for chat and slideshows
export async function generateImage(prompt: string, size: "1024x1024" | "1024x1536" | "1536x1024"): Promise<string> {
  const res = await client().images.generate({
    model: "gpt-image-1",
    prompt,
    size,
    n: 1,
    quality: "high",
  } as any);
  // Returns base64
  const b64 = (res.data?.[0] as any)?.b64_json;
  if (!b64) throw new Error("No image returned");
  return `data:image/png;base64,${b64}`;
}

export async function generateHooks(topic: string, count = 5): Promise<string[]> {
  const system = "You write scroll-stopping short-form video hooks. Punchy, curious, under 12 words. No hashtags. No emojis. Never invent statistics, percentages or results. Return one hook per line, no numbering.";
  const prompt = `Topic: ${topic}\n\nWrite ${count} hooks.`;
  const fallback = async (): Promise<string> => {
    const result = await groqMessage({ system, messages: [{ role: "user", content: prompt }], max_tokens: 400 });
    return result.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  };
  let text: string;
  if (!process.env.OPENAI_API_KEY?.trim()) {
    if (!groqConfigured()) throw new Error("No hook-generation provider is configured");
    text = await fallback();
  } else {
    try {
      const res = await client().chat.completions.create({
        model: "gpt-4o-mini", temperature: 0.9,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      }, { maxRetries: 0, timeout: 20_000 });
      text = res.choices[0]?.message?.content ?? "";
    } catch (error) {
      if (!groqConfigured() || !canFallback(error)) throw error;
      text = await fallback();
    }
  }
  return text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, count);
}
