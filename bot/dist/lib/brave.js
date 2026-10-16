"use strict";
// Thin wrapper around the Brave Search API for the Discord bot.
// Requires BRAVE_API_KEY to be set on the bot's environment (Railway).
Object.defineProperty(exports, "__esModule", { value: true });
exports.braveConfigured = braveConfigured;
exports.braveSearch = braveSearch;
const BRAVE_BASE = "https://api.search.brave.com/res/v1";
function braveConfigured() {
    return Boolean(process.env.BRAVE_API_KEY);
}
async function braveSearch(opts) {
    const key = process.env.BRAVE_API_KEY;
    if (!key)
        throw new Error("BRAVE_API_KEY not set");
    const params = new URLSearchParams({
        q: opts.query,
        count: String(Math.min(opts.count ?? 5, 10)),
        safesearch: "moderate",
        text_decorations: "false",
        spellcheck: "true",
    });
    const res = await fetch(`${BRAVE_BASE}/web/search?${params}`, {
        headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": key,
        },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Brave search failed: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const data = (await res.json());
    const results = data.web?.results ?? [];
    return results.map((r) => ({
        title: stripTags(r.title ?? ""),
        url: r.url,
        description: stripTags(r.description ?? ""),
        age: r.age,
    }));
}
function stripTags(s) {
    return s.replace(/<[^>]+>/g, "");
}
