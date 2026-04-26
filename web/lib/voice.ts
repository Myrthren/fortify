import { claude, CLAUDE_MODELS } from "@/lib/claude";

/**
 * Train a brand voice from writing samples.
 * One-shot: feed Claude the samples, get back a detailed system prompt
 * that captures tone, vocabulary, structure, do's, and don'ts.
 */
export async function trainBrandVoice(opts: {
  name: string;
  samples: string;
}): Promise<{ systemPrompt: string }> {
  const res = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1500,
    system: VOICE_TRAINER_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Voice name: ${opts.name}\n\nWriting samples (each separated by ---):\n\n${opts.samples}\n\nProduce the voice profile system prompt now. Output ONLY the system prompt — no preface, no markdown headers, no commentary.`,
      },
    ],
  });

  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();

  if (!text) throw new Error("Claude returned empty voice profile");
  return { systemPrompt: text };
}

/**
 * Generate content in a trained brand voice.
 * Uses prompt caching on the system prompt so repeat calls with the
 * same voice are cheap (cache hits ~90% off input cost).
 */
export async function generateInVoice(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: opts.maxTokens ?? 1000,
    system: [
      {
        type: "text",
        text: opts.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: opts.userPrompt }],
  });

  return res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();
}

const VOICE_TRAINER_SYSTEM = `You are a brand voice analyst. Given 3-15 writing samples from one author, you produce a detailed "voice profile" — a system prompt that another AI can follow to write in that exact voice.

The profile must capture:
1. **Tone & energy** — formal/casual, warm/blunt, optimistic/contrarian, etc.
2. **Sentence structure** — short staccato vs long flowing, fragments allowed?
3. **Vocabulary patterns** — specific words/phrases the author uses repeatedly, words they avoid
4. **Punctuation & formatting** — em-dashes, ellipses, line breaks, all-caps emphasis, lowercase preference?
5. **Rhetorical moves** — questions, lists, contrast pairs, callbacks, specific hooks
6. **Do's** — 5-8 concrete things to do
7. **Don'ts** — 5-8 concrete things to avoid

Format the output as a clean system prompt starting with "You write like {NAME}." then the rules. No markdown headers, no bullet labels like "Tone:" — write it as a flowing prompt that another AI will read and follow. Aim for 200-400 words.

Be specific. "Use short sentences" is weak. "Sentences average 6-9 words. Fragments common. Never two long sentences in a row." is strong.`;
