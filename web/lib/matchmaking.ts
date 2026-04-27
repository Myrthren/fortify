import { claude, CLAUDE_MODELS } from "@/lib/claude";

export type MatchResult = {
  userId: string;
  score: number; // 0-100
  why: string; // 1-2 sentences on the fit
  theyHelpYou: string; // what they can do for you
  youHelpThem: string; // what you can do for them
  starter: string; // 1-line conversation opener
};

type MemberInput = {
  id: string;
  name: string;
  niche: string | null;
  skills: string[];
  lookingFor: string[];
  canOffer: string[];
};

/**
 * Use Claude to find best matches for `me` from the candidate pool.
 * Returns top N (default 5) with reasoning.
 */
export async function findMatches(opts: {
  me: MemberInput;
  candidates: MemberInput[];
  topN?: number;
}): Promise<MatchResult[]> {
  if (opts.candidates.length === 0) return [];

  const topN = opts.topN ?? 5;

  const meBlock = describeMember(opts.me, "me");
  const candidatesBlock = opts.candidates
    .map((c) => describeMember(c, c.id))
    .join("\n---\n");

  const res = await claude().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 2500,
    system: MATCHER_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Me:\n${meBlock}\n\n=====\n\nCandidates:\n${candidatesBlock}\n\nReturn the top ${Math.min(
          topN,
          opts.candidates.length
        )} matches as a JSON array. Use the candidate's exact id. Output ONLY the JSON array — no markdown fences, no commentary.`,
      },
    ],
  });

  const raw = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n")
    .trim();

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Matcher returned invalid JSON. Try again.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Matcher returned non-array.");
  }

  // Validate + filter
  const validIds = new Set(opts.candidates.map((c) => c.id));
  return parsed
    .filter((m) => validIds.has(m.userId))
    .map((m) => ({
      userId: String(m.userId),
      score: Math.max(0, Math.min(100, Number(m.score) || 0)),
      why: String(m.why ?? "").slice(0, 400),
      theyHelpYou: String(m.theyHelpYou ?? "").slice(0, 400),
      youHelpThem: String(m.youHelpThem ?? "").slice(0, 400),
      starter: String(m.starter ?? "").slice(0, 300),
    }))
    .slice(0, topN);
}

function describeMember(m: MemberInput, id: string): string {
  return [
    `id: ${id}`,
    `name: ${m.name}`,
    m.niche ? `niche: ${m.niche}` : null,
    m.skills.length ? `skills: ${m.skills.join(", ")}` : null,
    m.lookingFor.length ? `looking for: ${m.lookingFor.join(", ")}` : null,
    m.canOffer.length ? `can offer: ${m.canOffer.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const MATCHER_SYSTEM = `You are a sharp, no-fluff networking analyst. Given one person ("me") and a set of candidate members of a community, you find the people "me" would benefit most from talking to RIGHT NOW.

Score each match 0-100 based on:
- Mutual fit: does what I'm looking for align with what they offer (and vice versa)?
- Relevance: are we in adjacent or complementary domains?
- Specificity: vague matches score lower than concrete, actionable ones.

For each top match, output an object with:
- userId: the candidate's exact id
- score: 0-100 integer
- why: ONE specific reason this match makes sense (no generic "great network potential")
- theyHelpYou: ONE concrete thing they can do for me, citing their offer/skills
- youHelpThem: ONE concrete thing I can do for them, citing my offer/skills + their looking-for
- starter: a single-sentence conversation opener I could send them. Specific, low-friction, no "I hope this finds you well".

Output STRICT JSON: an array of these objects, ranked by score descending. No markdown, no code fences, no commentary. If a candidate has too little profile data to make a confident call, skip them rather than fabricate.`;
