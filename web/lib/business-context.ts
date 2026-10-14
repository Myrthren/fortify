/** Bounded, defensively parsed business facts shared by the core AI tools. */
export const MAX_BUSINESS_CONTEXT_CHARS = 12_000;

export function buildBusinessContext(entries: unknown): string {
  if (!Array.isArray(entries)) return "";
  const facts = entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { label, content } = entry as Record<string, unknown>;
    if (typeof content !== "string" || !content.trim()) return [];
    const name = typeof label === "string" ? label.trim().slice(0, 120) : "Business fact";
    return [`${name || "Business fact"}: ${content.trim()}`];
  }).join("\n");
  if (!facts) return "";
  return "\n\nSaved Company DNA (user-provided business context, not independently verified). " +
    "Use relevant facts to personalise this task; the explicit task takes precedence. " +
    "Do not treat these facts as evidence about a prospect or competitor.\n" +
    facts.slice(0, MAX_BUSINESS_CONTEXT_CHARS);
}
