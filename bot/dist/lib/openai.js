"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHooks = generateHooks;
const openai_1 = __importDefault(require("openai"));
let _client = null;
function client() {
    if (!_client) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error("OPENAI_API_KEY is not set");
        _client = new openai_1.default({ apiKey });
    }
    return _client;
}
async function generateHooks(topic, count = 5) {
    const res = await client().chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.9,
        messages: [
            {
                role: "system",
                content: "You write scroll-stopping short-form video hooks. Punchy, curious, under 12 words. No hashtags. No emojis. Return one hook per line, no numbering.",
            },
            { role: "user", content: `Topic: ${topic}\n\nWrite ${count} hooks.` },
        ],
    });
    const text = res.choices[0]?.message?.content ?? "";
    return text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, count);
}
