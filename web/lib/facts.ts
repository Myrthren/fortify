// Percentages, multipliers and money amounts read as factual claims to a
// prospect. Flag any the user did not supply so we never ship an invented one.
const CLAIM = /[£$€]\s?\d[\d,.]*\s?[kKmM]?\b|\d[\d,.]*\s?(?:%|×|x\b)/g;

function key(claim: string): string {
  const n = claim.replace(/[^\d.]/g, "").replace(/\.$/, "");
  return /%/.test(claim) ? `%${n}` : /[×x]$/.test(claim.trim()) ? `x${n}` : `money${n}`;
}

export function unsupportedFigures(text: string, ...sources: string[]): string[] {
  const source = sources.join(" ");
  const allowed = new Set((source.match(CLAIM) ?? []).map(key));
  // A bare number in the brief ("250 one-off") still supports a money amount.
  for (const n of source.match(/\d[\d,.]*/g) ?? []) allowed.add(key(`£${n}`));
  return [...new Set((text.match(CLAIM) ?? []).filter((c) => !allowed.has(key(c))).map((c) => c.trim()))];
}
