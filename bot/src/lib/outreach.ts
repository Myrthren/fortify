import { claude, CLAUDE_MODELS } from "./claude";
import { generateInVoice } from "./voice";

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
- Sound like a peer, not a salesperson`;

export async function generateOutreach(opts: {
  prospect: string;
  offer: string;
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

  if (opts.voiceSystemPrompt) {
    return generateInVoice({
      systemPrompt:
        opts.voiceSystemPrompt +
        `\n\nWhen asked to write outreach, follow the user's channel rules and these:\n${BASE_RULES}`,
      userPrompt,
      maxTokens: 600,
    });
  }

  const res = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 600,
    system:
      "You write cold outreach that gets replies. You sound like a sharp human, not a marketer. You never use cliches. " +
      BASE_RULES,
    messages: [{ role: "user", content: userPrompt }],
  });

  return res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();
}
