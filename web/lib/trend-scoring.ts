import type { BraveResult } from "@/lib/brave";

function ageHours(age?: string): number | null {
  const match = age
    ?.toLowerCase()
    .match(/(\d+)\s*(minute|hour|day|week|month|year)/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  return amount *
    (unit.startsWith("minute")
      ? 1 / 60
      : unit.startsWith("hour")
        ? 1
        : unit.startsWith("day")
          ? 24
          : unit.startsWith("week")
            ? 168
            : unit.startsWith("month")
              ? 730
              : 8760);
}

export function scoreTrend(
  term: string,
  result: Pick<BraveResult, "title" | "description" | "age">
) {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${result.title} ${result.description}`.toLowerCase();
  const matches = words.filter((word) => haystack.includes(word)).length;
  const relevance = words.length
    ? Math.round((matches / words.length) * 100)
    : 0;
  const hours = ageHours(result.age);
  const freshness =
    hours === null
      ? 35
      : Math.max(5, Math.round(100 - Math.min(hours, 720) / 7.2));
  const opportunity = Math.round(relevance * 0.55 + freshness * 0.45);

  return { relevance, freshness, opportunity };
}
