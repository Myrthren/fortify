// Percentages, multipliers, money amounts and counts read as factual claims to
// a prospect. Flag any the user did not supply so we never ship an invented one.
const CLAIM = /[£$€]\s?\d[\d,.]*\s?[kKmM]?\b|\d[\d,.]*\s?(?:%|×|x\b)/g;
// Counts of 10+ ("47 clients", "30-plus visitors"). Times and durations such as
// "15-minute call" or "6 AM" are scheduling detail, not claims, so skip them.
const COUNT = /\b\d{2,}[\d,]*(?![\d,.]|\s?(?:%|×|x\b)|\/|[-\s]?(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?|am|pm)\b)/gi;

function key(claim: string): string {
  const n = claim.replace(/[^\d.]/g, "").replace(/\.$/, "");
  return /%/.test(claim) ? `%${n}` : /[×x]$/.test(claim.trim()) ? `x${n}` : `n${n}`;
}

export function unsupportedFigures(text: string, ...sources: string[]): string[] {
  const source = sources.join(" ");
  const allowed = new Set((source.match(CLAIM) ?? []).map(key));
  // A bare number in the brief ("250 one-off") supports a money amount or count.
  for (const n of source.match(/\d[\d,.]*/g) ?? []) allowed.add(key(n));
  const found = [...(text.match(CLAIM) ?? []), ...(text.replace(CLAIM, " ").match(COUNT) ?? [])];
  return [...new Set(found.filter((c) => !allowed.has(key(c))).map((c) => c.trim()))];
}
