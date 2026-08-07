import type { VariationChoice } from "@/lib/outbound/types";

/**
 * Anti-template variation.
 *
 * The failure mode of AI cold email is not bad writing — it is that every email
 * has the same skeleton. Same greeting, same "I noticed X" opener, same
 * three-paragraph body, same "Worth a quick chat?" close. Prospects who get two
 * of them spot it instantly.
 *
 * So the shape of each email is decided before the model is called, by rolling
 * dice across six independent axes. The model is told to write to that shape.
 * With the counts below there are 8x10x8x8x8x9 = ~3.7M skeletons, which means
 * collision inside any realistic campaign is negligible.
 *
 * The roll is seeded from leadId+step, so re-generating an email for the same
 * lead gives the same skeleton — regeneration should fix the prose, not silently
 * change the strategy, and a stored `variation` stays meaningful.
 */

const GREETINGS = [
  "Use their first name only, no comma fuss: 'Sarah —'",
  "Use 'Hi <first name>,'",
  "Use 'Hey <first name>,'",
  "Use '<First name>,' on its own line",
  "No greeting at all — open straight into the observation",
  "Use 'Morning <first name>,' (or just 'Morning,' if no name is known)",
  "Address the business rather than a person: 'To whoever handles enquiries at <company> —'",
  "Use 'Hello <first name>,'",
];

const OPENINGS = [
  "Open with the single most specific thing you noticed on their site. No preamble.",
  "Open with a short factual statement about how their current process appears to work, then why that costs them.",
  "Open with a direct question about the thing you noticed. One line, no hedging.",
  "Open by naming what they are doing well, in one clause, then pivot to the gap. Do not gush.",
  "Open with a number or concrete detail from their site (page count, response time, missing element).",
  "Open mid-thought, as if continuing a conversation: 'Your booking page does the hard part — then hands it back to a human.'",
  "Open with a comparison to how similar businesses in their sector handle it. No name-dropping of fake clients.",
  "Open with what happens to an enquiry that arrives at 9pm on their site.",
  "Open by stating the observation as a small hypothesis you want checked: 'Guessing enquiries still land in an inbox rather than anywhere structured.'",
  "Open with the consequence first, the observation second.",
];

const STRUCTURES = [
  "Three short paragraphs: observation, implication, ask.",
  "Two paragraphs only. First does observation and implication together, second is the ask.",
  "One tight paragraph, then the ask on its own line.",
  "Observation paragraph, then two short lines as a mini-list (no bullets, just line breaks), then the ask.",
  "Four very short paragraphs, one or two sentences each.",
  "Lead with a one-line hook, blank line, then a single explanatory paragraph, then the ask.",
  "Observation, then a single rhetorical question, then the ask. Very short overall.",
  "Observation, then a concrete 'what this would look like instead' sentence, then the ask.",
];

const TONES = [
  "Plain and direct. Short words. No adjectives that do not earn their place.",
  "Warm but efficient. Sounds like a competent person who is busy.",
  "Dry and slightly understated. British. Never jokey.",
  "Matter-of-fact and technical, as one operator to another.",
  "Curious rather than confident — you are asking whether you have read it right.",
  "Confident and brief, bordering on blunt, but never rude.",
  "Conversational and low-key, the way you would write to someone you were introduced to.",
  "Practical and specific, focused entirely on time and money.",
];

const SIGN_OFFS = [
  "Sign off with just the first name on its own line.",
  "Sign off 'Cheers,' then the name.",
  "Sign off 'Best,' then the name.",
  "Sign off with the name and, on the next line, the company name only.",
  "Sign off 'Thanks,' then the name.",
  "No sign-off word — just the name.",
  "Sign off with the name, then a single short line stating what the company does (under 8 words).",
  "Sign off '— <name>' on one line.",
];

const CTAS = [
  "Ask if they want the specific thing spelled out in a reply. No meeting.",
  "Ask for a 10-minute call, naming the length explicitly.",
  "Ask a yes/no question they can answer in one word.",
  "Offer to send a short written breakdown, and ask if they want it.",
  "Ask whether they have already solved it, giving them an easy out.",
  "Ask who the right person is, if it is not them.",
  "Ask if it is worth a conversation, with no time commitment named.",
  "Offer to record a two-minute walkthrough of what you would change, and ask if that is useful.",
  "Ask them to reply with a single word if they want more.",
];

/** Deterministic 32-bit hash, so the same seed always rolls the same skeleton. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough distribution for picking from lists. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollVariation(leadId: string, step: number): VariationChoice {
  const next = rng(hash(`${leadId}:${step}`));
  const pick = <T>(arr: T[]): T => arr[Math.floor(next() * arr.length)];

  const choice: VariationChoice = {
    greeting: pick(GREETINGS),
    opening: pick(OPENINGS),
    structure: pick(STRUCTURES),
    tone: pick(TONES),
    signOff: pick(SIGN_OFFS),
    cta: pick(CTAS),
    // 70-140 is the spec; aim inside it so the guardrail rarely has to reject.
    targetWords: 80 + Math.floor(next() * 45),
  };

  // Follow-ups are shorter than first touches, always. A follow-up as long as
  // the original reads as a resend and gets deleted.
  if (step > 0) {
    choice.targetWords = Math.max(45, Math.round(choice.targetWords * 0.65));
  }

  return choice;
}
