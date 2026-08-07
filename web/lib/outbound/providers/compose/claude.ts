import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { BANNED_PHRASES } from "@/lib/outbound/guardrails";
import type {
  ComposeInput,
  ComposeProvider,
  ComposedEmail,
} from "@/lib/outbound/types";

/**
 * Claude-backed email composition.
 *
 * The model is never asked "write a cold email". It is handed a pre-rolled
 * skeleton (see variation.ts) plus a fixed list of evidence-backed observations,
 * and told to write to that shape using only those observations. That split is
 * what keeps 500 emails from a single campaign reading as 500 different people
 * wrote them.
 */
export const claudeComposer: ComposeProvider = {
  key: "claude",
  label: "Claude",

  isAvailable() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  async compose(input: ComposeInput): Promise<ComposedEmail> {
    const model = CLAUDE_MODELS.fast;
    const system = input.voiceSystemPrompt
      ? `${input.voiceSystemPrompt}\n\nYou are now writing a cold outreach email. The rules below override any conflicting style guidance above.\n\n${SYSTEM}`
      : SYSTEM;

    const res = await claude().messages.create({
      model,
      max_tokens: 900,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } } as never,
      ],
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return { ...splitSubjectAndBody(text), model };
  },
};

const SYSTEM = `You write cold emails that read as though a specific human sat down and wrote to one specific business. You are not a marketer and you never sound like one.

Non-negotiable rules:
- Use ONLY the observations supplied. Never invent a fact about the business, their staff, their customers, their revenue, their tools, or their history. If the observations are thin, write a shorter email.
- Never claim to have used their service, visited their premises, been referred by anyone, or spoken to them before.
- No statistics, case studies, client names or percentages unless they are given to you verbatim.
- Never state or imply the email was written by AI, and never mention automation of the email itself.
- Write in plain text. No markdown, no bold, no bullet characters, no emojis, no links unless one is supplied.
- One ask. Not two.
- Cut any sentence that would survive being pasted into an email to a different company. If it is not specific to this one, delete it.

Banned openers and phrases — never use these or near-variants:
${BANNED_PHRASES.map((p) => `- "${p}"`).join("\n")}

Subject lines: lowercase or sentence case, 2-7 words, no colons-as-formatting, no company name stuffing, no clickbait, never a question mark and exclamation mark together. It should look like an email from a person, not a campaign.

Output format — exactly this, nothing else:
Subject: <subject line>
<blank line>
<body>`;

function buildPrompt(input: ComposeInput): string {
  const parts: string[] = [];

  parts.push("BUSINESS YOU ARE WRITING TO");
  parts.push(`Company: ${input.lead.company}`);
  if (input.lead.contactName) parts.push(`Contact: ${input.lead.contactName}`);
  else parts.push("Contact: unknown — you do not have a name, write accordingly");
  if (input.lead.industry) parts.push(`Industry: ${input.lead.industry}`);
  if (input.lead.location) parts.push(`Location: ${input.lead.location}`);

  parts.push("", "YOU");
  parts.push(`Name: ${input.sender.name}`);
  if (input.sender.title) parts.push(`Role: ${input.sender.title}`);
  parts.push(`What you offer: ${input.offer}`);

  parts.push("", "OBSERVATIONS YOU MAY USE (nothing outside this list is known to you)");
  const opps = input.analysis?.opportunities ?? [];
  if (opps.length) {
    opps.forEach((o, i) => {
      parts.push(
        `${i + 1}. ${o.title}`,
        `   What was actually seen: ${o.evidence}`,
        `   Impact: ${o.impact}`,
        `   Relevant service: ${o.fortifyService}`
      );
    });
    parts.push(
      "",
      "Build the email around observation 1. Reference at most one other. Do not list them."
    );
  } else {
    parts.push(
      "(none specific)",
      "",
      "You have no specific observation. Write a short, honest email that does not pretend otherwise — no fake specificity."
    );
  }

  if (input.analysis?.summary) {
    parts.push("", "ANALYST SUMMARY (context for you, do not quote it):", input.analysis.summary);
  }

  if (input.step > 0 && input.previousEmails.length) {
    parts.push("", "WHAT YOU ALREADY SENT (they did not reply)");
    input.previousEmails.forEach((e, i) => {
      parts.push(
        `--- email ${i + 1}${e.sentAt ? ` (sent ${e.sentAt.toISOString().slice(0, 10)})` : ""} ---`,
        `Subject: ${e.subject}`,
        e.body
      );
    });
    parts.push(
      "",
      `This is follow-up ${input.step} of the sequence. Rules for follow-ups:`,
      "- Do not restate the original email. Assume they read it.",
      "- Add something: a different angle, a concrete example of the change, or a narrower ask.",
      "- Shorter than the last one.",
      "- Never guilt them, never say 'just following up', 'bumping this', 'circling back', or 'did you see my last email'.",
      "- If this is the final follow-up, close the loop gracefully and make it easy to say no."
    );
  }

  if (input.avoidPhrases?.length) {
    parts.push(
      "",
      "ALREADY USED IN RECENT EMAILS TO OTHER BUSINESSES — do not reuse these openers or subjects:",
      ...input.avoidPhrases.slice(0, 25).map((p) => `- ${p}`)
    );
  }

  parts.push(
    "",
    "THE SHAPE OF THIS PARTICULAR EMAIL (follow all six exactly)",
    `Greeting: ${input.variation.greeting}`,
    `Opening: ${input.variation.opening}`,
    `Structure: ${input.variation.structure}`,
    `Tone: ${input.variation.tone}`,
    `Call to action: ${input.variation.cta}`,
    `Sign-off: ${input.variation.signOff}`,
    `Target length: about ${input.variation.targetWords} words in the body. Hard limits: no fewer than 70 and no more than 140.`,
    "",
    "Write it now. Subject line first, then a blank line, then the body. Nothing else."
  );

  return parts.join("\n");
}

/**
 * The model is told to emit `Subject: ...` then a blank line then the body, and
 * usually does. The fallbacks cover the cases where it drops the label or wraps
 * the whole thing in a fence.
 */
function splitSubjectAndBody(raw: string): { subject: string; body: string } {
  let text = raw
    .trim()
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const match = text.match(/^\s*subject\s*:\s*(.+?)\s*\n([\s\S]*)$/i);
  if (match) {
    return { subject: cleanSubject(match[1]), body: match[2].trim() };
  }

  // No label — treat a short first line as the subject.
  const lines = text.split("\n");
  const first = lines[0]?.trim() ?? "";
  if (first && first.length <= 90 && lines.length > 1 && !first.endsWith(".")) {
    return { subject: cleanSubject(first), body: lines.slice(1).join("\n").trim() };
  }

  return { subject: "", body: text };
}

function cleanSubject(s: string): string {
  return s
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 140);
}
