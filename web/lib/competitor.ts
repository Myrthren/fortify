import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { braveSearch } from "@/lib/brave";

export type CompetitorReport = {
  positioning: string;
  recentMoves: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  summary: string;
};

const MAX_HTML_CHARS = 80000;
const MAX_TEXT_CHARS = 8000;

export async function scanCompetitor(opts: {
  name: string;
  url: string;
  myProfile?: {
    niche?: string | null;
    skills?: string[];
    canOffer?: string[];
  } | null;
}): Promise<CompetitorReport> {
  // 1. Fetch the competitor's homepage
  let url = opts.url.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FortifyScanner/1.0; +https://fortify-io.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) html = await res.text();
  } catch {
    /* ignore — we still have search results */
  }
  if (html.length > MAX_HTML_CHARS) html = html.slice(0, MAX_HTML_CHARS);
  const siteText = htmlToText(html).slice(0, MAX_TEXT_CHARS);

  // 2. Brave search for recent news / mentions
  let searchSnippets = "";
  try {
    const results = await braveSearch({
      query: `"${opts.name}" news`,
      count: 8,
      freshness: "pm", // past month
    });
    searchSnippets = results
      .map((r) => `- ${r.title} (${r.source ?? "?"}, ${r.age ?? "?"}): ${r.description}`)
      .join("\n");
  } catch {
    /* search optional */
  }

  if (siteText.length < 100 && !searchSnippets) {
    throw new Error(
      "Couldn't fetch the site or any recent news. Check the URL and try again."
    );
  }

  const myContext = opts.myProfile
    ? `For context, the user (the one asking) describes themselves as:
- niche: ${opts.myProfile.niche ?? "?"}
- skills: ${opts.myProfile.skills?.join(", ") ?? "?"}
- can offer: ${opts.myProfile.canOffer?.join(", ") ?? "?"}

Tailor "opportunities" to be specific things THIS user could do given their position.`
    : `The user has not given context about themselves; keep "opportunities" generic but actionable.`;

  const userPrompt = `Competitor: ${opts.name}
URL: ${url}

Homepage text (truncated):
${siteText || "(no readable content)"}

Recent news / mentions (past month, via Brave):
${searchSnippets || "(none found)"}

${myContext}

Return the report as a JSON object. Output ONLY the JSON — no fences, no commentary.`;

  const res = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1500,
    system: SCAN_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  let parsed: CompetitorReport;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Scan returned invalid JSON. Try again.");
  }
  return parsed;
}

function htmlToText(html: string): string {
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

const SCAN_SYSTEM = `You are a sharp competitive-intelligence analyst. Given a competitor's homepage text and recent news mentions, you produce a structured intel report.

Return ONLY a JSON object with this exact shape (no markdown fences, no commentary):

{
  "positioning": "1-2 sentences on how they position themselves and to whom.",
  "recentMoves": ["Concrete recent move", "..."],   // 2-5 items, cite the news where possible
  "strengths": ["Specific thing they do well", "..."],   // 3-5 items
  "weaknesses": ["Specific gap or vulnerability", "..."],   // 2-4 items, be specific
  "opportunities": ["Specific opening for the user to exploit", "..."],   // 3-5 items
  "summary": "2-3 sentences: bottom-line read."
}

Be SPECIFIC. Don't say "they have a strong brand" — say WHAT specifically (concrete claim, design choice, customer logo, etc.).
Cite numbers, names, dates where present. Don't make things up; if data is thin, say so in fewer items.`;
