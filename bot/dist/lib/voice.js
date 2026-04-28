"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInVoice = generateInVoice;
const claude_1 = require("./claude");
async function generateInVoice(opts) {
    const res = await (0, claude_1.claude)().messages.create({
        model: claude_1.CLAUDE_MODELS.fast,
        max_tokens: opts.maxTokens ?? 1000,
        // SDK 0.32 doesn't type cache_control yet; the API accepts it.
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
        .map((b) => b.text)
        .join("\n")
        .trim();
}
