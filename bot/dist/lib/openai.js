"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHooks = generateHooks;
const claude_1 = require("./claude");
async function generateHooks(topic, count = 5) {
    const result = await (0, claude_1.claude)().messages.create({
        model: claude_1.CLAUDE_MODELS.fast, max_tokens: 600,
        system: "You write scroll-stopping short-form video hooks. Punchy, curious, under 12 words. No hashtags. No emojis. Never invent statistics, percentages or results. Return one hook per line, no numbering.",
        messages: [{ role: "user", content: `Topic: ${topic}\n\nWrite ${count} hooks.` }],
    });
    return result.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, count);
}
