import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { generateInVoice } from "@/lib/voice";
import { unsupportedFigures } from "@/lib/facts";

export const OUTREACH_CHANNELS = ["dm", "email", "linkedin", "cold-email"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

const CHANNEL_GUIDELINES: Record<OutreachChannel, string> = {
  dm: "Twitter/X DM. ~2 short sentences. No greeting fluff. Casual.",
  email: "General cold email. Subject line + body. Body 4-6 short sentences max. Plain text.",
  linkedin: "LinkedIn message. Slightly more professional than DM. 3-5 sentences. No 'I hope this finds you well'.",
  "cold-email": "Cold sales email. Subject line + body. Body 5-8 sentences. One specific personalisation, one clear ask, no buzzwords.",
};

const BASE_RULES = `Rules:
- One specific personalisation tied to the prospect (not generic "love your work")
- Lead with value or insight, not your offer
- One clear ask, no multi-step
- Cut every word that doesn't earn its place
- No "Hope you're well", no "Just circling back", no "Quick question"
- No emojis unless the channel is DM
- Sound like a peer, not a salesperson
- Use only facts stated above about the prospect and the offer. Never invent statistics, percentages, results, client names or testimonials; if no figure was given, make the point without one`;

export async function generateOutreach(opts: {
  prospect: string; // who they are (paste bio, role, recent post, etc.)
  offer: string; // what you want / are offering
  channel: OutreachChannel;
  voiceSystemPrompt?: string | null;
}): Promise<string> {
  const channelRule = CHANNEL_GUIDELINES[opts.channel];
  const userPrompt = `Channel: ${opts.channel} (${channelRule})

Prospect:
${opts.prospect}

What I want / am offering:
${opts.offer}

Write the message now. ${BASE_RULES}

Output ONLY the message (with subject line if email). No commentary, no markdown.`;

  const draft = async (correction = ""): Promise<string> => {
    if (opts.voiceSystemPrompt) {
      return generateInVoice({
        systemPrompt:
          opts.voiceSystemPrompt +
          `\n\nWhen asked to write outreach, follow the user's channel rules and these:\n${BASE_RULES}`,
        userPrompt: userPrompt + correction,
        maxTokens: 600,
      });
    }

    const res = await claude().messages.create({
      model: CLAUDE_MODELS.fast,
      max_tokens: 600,
      system:
        "You write cold outreach that gets replies. You sound like a sharp human, not a marketer. You never use cliches. " +
        BASE_RULES,
      messages: [{ role: "user", content: userPrompt + correction }],
    });

    return res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
  };

  // Voices and some models ignore the no-invented-figures rule; check in code
  // and give the model one chance to rewrite before showing the draft.
  const message = await draft();
  const invented = unsupportedFigures(message, opts.prospect, opts.offer);
  if (!invented.length) return message;
  const retry = await draft(
    `\n\nYour previous draft invented these figures: ${invented.join(", ")}. Rewrite it without any percentage, multiplier or money amount that is not stated above.`,
  );
  return unsupportedFigures(retry, opts.prospect, opts.offer).length < invented.length ? retry : message;
}
