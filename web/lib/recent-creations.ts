/** Turn stored generation inputs into short, human-readable dashboard titles. */
export function creationTitle(input: string, type: string): string {
  const compact = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 120);
  const fallback = type === "outreach" ? "Outreach message" : "Recent creation";
  const text = input.trim();
  if (!text) return fallback;
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data)) return fallback;
      if (type === "outreach" && typeof data.prospect === "string" && data.prospect.trim()) {
        return compact(`Outreach for ${data.prospect}`);
      }
      for (const key of ["title", "topic", "query", "niche", "offer"]) {
        if (typeof data[key] === "string" && data[key].trim()) return compact(data[key]);
      }
    } catch { /* Older records may contain incomplete structured input. */ }
    return fallback;
  }
  return compact(text);
}
