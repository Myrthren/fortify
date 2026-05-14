import { claude, CLAUDE_MODELS } from "@/lib/claude";
import { braveSearch } from "@/lib/brave";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PlatformAnalysis = {
  score: number;        // 1–10
  verdict: string;      // one-line summary
  suggestions: string[];
  tags: string[];
  bestTime: string;
  titleTweak: string | null;
};

export type ViralityReport = {
  platforms: Partial<Record<"tiktok" | "youtube" | "facebook", PlatformAnalysis>>;
  summary: string;
  analyzedAt: string;
};

// ── Best posting times (platform best-practices) ──────────────────────────────

const BEST_TIMES: Record<string, string> = {
  tiktok:   "7–9am, 12–3pm, or 7–11pm (audience's local time)",
  youtube:  "2–4pm on weekdays, or Sat/Sun 9–11am",
  facebook: "1–4pm on weekdays, especially Wed 3pm",
};

// ── Pull platform trends via Brave ────────────────────────────────────────────

async function getPlatformTrends(platform: string, category: string): Promise<string> {
  try {
    const query =
      platform === "tiktok"   ? `trending tiktok videos ${category} 2025` :
      platform === "youtube"  ? `trending youtube videos ${category} 2025` :
                                `trending facebook videos ${category} 2025`;

    const results = await braveSearch({ query, count: 8, freshness: "pw" });
    if (!results.length) return "No trend data found.";
    return results
      .slice(0, 6)
      .map((r) => `- ${r.title}: ${r.description}`)
      .join("\n");
  } catch {
    return "Trend data unavailable.";
  }
}

// ── Core analysis ─────────────────────────────────────────────────────────────

export async function analyzeMediaItem(item: {
  title: string;
  description?: string | null;
  category?: string | null;
  targetPlatforms: string[];
}): Promise<ViralityReport> {
  const platforms = item.targetPlatforms.filter((p) =>
    ["tiktok", "youtube", "facebook"].includes(p)
  ) as ("tiktok" | "youtube" | "facebook")[];

  // Fetch trend data for all target platforms in parallel
  const trendData = await Promise.all(
    platforms.map((p) => getPlatformTrends(p, item.category ?? item.title))
  );

  const platformContext = platforms
    .map((p, i) => `--- ${p.toUpperCase()} TRENDS ---\n${trendData[i]}`)
    .join("\n\n");

  const prompt = `You are a viral content strategist specialising in short-form and social video.

Analyse this video for virality potential across the specified platforms.

VIDEO:
Title: "${item.title}"
Description: "${item.description ?? "(none provided)"}"
Category: "${item.category ?? "general"}"
Target platforms: ${platforms.join(", ")}

CURRENT PLATFORM TRENDS (past week):
${platformContext}

Return ONLY valid JSON in this exact shape — no markdown, no prose:
{
  "platforms": {
    ${platforms.map((p) => `"${p}": {
      "score": <number 1-10>,
      "verdict": "<one sentence — how likely is this to perform and why>",
      "suggestions": ["<specific improvement>", "<specific improvement>", "<specific improvement>"],
      "tags": ["<hashtag without #>", "<hashtag>", "<hashtag>", "<hashtag>", "<hashtag>"],
      "bestTime": "${BEST_TIMES[p]}",
      "titleTweak": "<improved title or null if it's already strong>"
    }`).join(",\n    ")}
  },
  "summary": "<2-sentence overall virality verdict across all platforms>"
}`;

  const msg = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();
  let report: Omit<ViralityReport, "analyzedAt">;
  try {
    report = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Claude returned invalid virality JSON");
    report = JSON.parse(match[0]);
  }

  return { ...report, analyzedAt: new Date().toISOString() };
}

// ── Optimal publish time ──────────────────────────────────────────────────────

/** Returns the next ideal publish DateTime for a given platform (UTC) */
export function getNextOptimalTime(platform: string): Date {
  const now = new Date();
  const hour = now.getUTCHours();

  if (platform === "tiktok") {
    // Target 12:00 UTC next day (roughly 7–9am US East)
    const target = new Date(now);
    target.setUTCDate(target.getUTCDate() + 1);
    target.setUTCHours(12, 0, 0, 0);
    return target;
  }

  if (platform === "youtube") {
    // Target 14:00 UTC next weekday
    const target = new Date(now);
    target.setUTCDate(target.getUTCDate() + 1);
    while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    target.setUTCHours(14, 0, 0, 0);
    return target;
  }

  // Facebook: next weekday at 13:00 UTC
  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + 1);
  while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  target.setUTCHours(13, 0, 0, 0);
  return target;
}
