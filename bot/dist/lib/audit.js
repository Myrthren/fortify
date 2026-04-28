"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditUrl = auditUrl;
const claude_1 = require("./claude");
const MAX_HTML_CHARS = 80000;
const MAX_TEXT_CHARS = 12000;
async function auditUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url))
        url = "https://" + url;
    let html;
    let title = null;
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; FortifyAuditor/1.0; +https://fortify-io.com)",
                Accept: "text/html,application/xhtml+xml",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok)
            throw new Error(`Fetch returned HTTP ${res.status}`);
        html = await res.text();
        if (!html)
            throw new Error("Empty response body");
    }
    catch (e) {
        throw new Error(`Could not fetch ${url}: ${e.message}`);
    }
    if (html.length > MAX_HTML_CHARS)
        html = html.slice(0, MAX_HTML_CHARS);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch)
        title = titleMatch[1].trim();
    const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
    if (text.length < 100) {
        throw new Error("Page returned too little text (likely a JS-rendered SPA).");
    }
    const res = await (0, claude_1.claude)().messages.create({
        model: claude_1.CLAUDE_MODELS.fast,
        max_tokens: 1500,
        system: AUDIT_SYSTEM,
        messages: [
            {
                role: "user",
                content: `URL: ${url}\nPage title: ${title ?? "(none)"}\n\nPage content (text-stripped):\n\n${text}\n\nReturn the audit as a JSON object now. Only JSON. No markdown fences.`,
            },
        ],
    });
    const raw = res.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch {
        throw new Error("Audit returned invalid JSON. Try again.");
    }
    return { url, title, ...parsed };
}
function htmlToText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}
const AUDIT_SYSTEM = `You audit landing pages and marketing funnels for conversion. You are sharp, specific, and unsentimental.

Given the text content of a page, produce a structured audit with the following JSON shape (and ONLY this shape — no extra keys, no markdown fences):

{
  "scores": {
    "clarity": 0-10,
    "headline": 0-10,
    "valueProp": 0-10,
    "cta": 0-10,
    "socialProof": 0-10,
    "friction": 0-10
  },
  "summary": "2-3 sentences overall verdict.",
  "wins": ["Specific thing done well", "..."],
  "issues": [
    { "area": "Headline", "severity": "high|med|low", "note": "Specific problem." }
  ],
  "fixes": ["Specific actionable fix", "..."]
}

Be specific. Score honestly — most pages are 4-7. A 9 or 10 is rare.`;
