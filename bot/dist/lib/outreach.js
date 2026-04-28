"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTREACH_CHANNELS = void 0;
exports.generateOutreach = generateOutreach;
const claude_1 = require("./claude");
const voice_1 = require("./voice");
exports.OUTREACH_CHANNELS = ["dm", "email", "linkedin", "cold-email"];
const CHANNEL_GUIDELINES = {
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
async function generateOutreach(opts) {
    const channelRule = CHANNEL_GUIDELINES[opts.channel];
    const userPrompt = `Channel: ${opts.channel} (${channelRule})

Prospect:
${opts.prospect}

What I want / am offering:
${opts.offer}

Write the message now. ${BASE_RULES}

Output ONLY the message (with subject line if email). No commentary, no markdown.`;
    if (opts.voiceSystemPrompt) {
        return (0, voice_1.generateInVoice)({
            systemPrompt: opts.voiceSystemPrompt +
                `\n\nWhen asked to write outreach, follow the user's channel rules and these:\n${BASE_RULES}`,
            userPrompt,
            maxTokens: 600,
        });
    }
    const res = await (0, claude_1.claude)().messages.create({
        model: claude_1.CLAUDE_MODELS.fast,
        max_tokens: 600,
        system: "You write cold outreach that gets replies. You sound like a sharp human, not a marketer. You never use cliches. " +
            BASE_RULES,
        messages: [{ role: "user", content: userPrompt }],
    });
    return res.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
}
