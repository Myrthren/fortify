import OpenAI from "openai";

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

// Logo generation using gpt-image-1
export async function generateLogoImage(prompt: string, size: "1024x1024" | "1024x1536" | "1536x1024"): Promise<string> {
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

// Analyze image with GPT-4o vision
export async function analyzeImageWithVision(base64DataUrl: string, prompt: string): Promise<string> {
  const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
  const mediaType = base64DataUrl.match(/^data:(image\/\w+);base64,/)?.[1] ?? "image/png";
  const res = await client().chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: "text", text: prompt },
        ],
      },
    ],
  } as any);
  return res.choices[0]?.message?.content ?? "";
}

// Logo enhancement using gpt-image-1 edit
export async function enhanceLogoImage(base64DataUrl: string, prompt: string, size: "1024x1024" | "1024x1536" | "1536x1024"): Promise<string> {
  // Convert base64 to a File/Blob for the API
  const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
  const bytes = Buffer.from(base64, "base64");
  const blob = new Blob([bytes], { type: "image/png" });
  const file = new File([blob], "logo.png", { type: "image/png" });

  const res = await client().images.edit({
    model: "gpt-image-1",
    image: file,
    prompt,
    size,
    n: 1,
  } as any);

  const b64 = (res.data?.[0] as any)?.b64_json;
  if (!b64) throw new Error("No enhanced image returned");
  return `data:image/png;base64,${b64}`;
}

export async function generateHooks(topic: string, count = 5): Promise<string[]> {
  const res = await client().chat.completions.create({
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
