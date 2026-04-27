// Thin wrapper around the Brave Search API
// https://api.search.brave.com/app/documentation

export type BraveResult = {
  title: string;
  url: string;
  description: string;
  age?: string; // human age e.g. "2 hours ago"
  source?: string; // domain
  favicon?: string;
};

const BRAVE_BASE = "https://api.search.brave.com/res/v1";

function key(): string {
  const k = process.env.BRAVE_API_KEY;
  if (!k) throw new Error("BRAVE_API_KEY not set");
  return k;
}

/**
 * Web search results, ranked by Brave's own ranker. Best-effort filtering
 * for "trending" by adding `freshness=pd` (past day) when desired.
 */
export async function braveSearch(opts: {
  query: string;
  count?: number;
  freshness?: "pd" | "pw" | "pm" | "py"; // past day/week/month/year
}): Promise<BraveResult[]> {
  const params = new URLSearchParams({
    q: opts.query,
    count: String(Math.min(opts.count ?? 10, 20)),
    safesearch: "moderate",
    text_decorations: "false",
    spellcheck: "true",
    extra_snippets: "false",
  });
  if (opts.freshness) params.set("freshness", opts.freshness);

  const res = await fetch(`${BRAVE_BASE}/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": key(),
    },
    // Cache at the request layer — Brave is rate-limited, no need to fetch every page render.
    next: { revalidate: 60 * 30 }, // 30 minutes
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brave search failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    web?: { results?: any[] };
  };

  const results = data.web?.results ?? [];
  return results.map((r) => ({
    title: stripTags(r.title ?? ""),
    url: r.url,
    description: stripTags(r.description ?? ""),
    age: r.age,
    source: r.profile?.long_name ?? r.profile?.name ?? hostname(r.url),
    favicon: r.profile?.img,
  }));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function hostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
