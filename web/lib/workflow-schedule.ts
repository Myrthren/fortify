import { validCron, cronTimeAt } from "@/lib/workflow-starters";

function matchField(field: string, value: number, minimum = 0): boolean {
  return field.split(",").some((segment) => {
    const [range, rawStep] = segment.split("/"); const step = Number(rawStep ?? 1);
    const [start, end] = range === "*" ? [minimum, Infinity] : range.includes("-") ? range.split("-").map(Number) : [Number(range), rawStep ? Infinity : Number(range)];
    return value >= start && value <= end && (value - start) % step === 0;
  });
}
export function scheduleMatches(expr: string, now: Date, timezone = "UTC"): boolean {
  if (!validCron(expr)) return false;
  const local = cronTimeAt(now, timezone); if (!local) return false;
  const [minute, hour, day, month, weekday] = expr.trim().split(/\s+/);
  const dayMatch = matchField(day, local.day, 1), weekdayMatch = matchField(weekday, local.weekday);
  // Standard cron: restricted day-of-month and weekday are alternatives.
  const dateMatch = day === "*" ? weekdayMatch : weekday === "*" ? dayMatch : dayMatch || weekdayMatch;
  return matchField(minute, local.minute) && matchField(hour, local.hour) && matchField(month, local.month, 1) && dateMatch;
}

/** Bounded catch-up; select the latest slot, never replay an entire outage backlog. */
export function latestScheduleSlot(expr: string, now: Date, timezone = "UTC"): { scheduledAt: Date; wallKey: string } | null {
  const minute = Math.floor(now.getTime() / 60_000) * 60_000;
  for (let ago = 0; ago <= 5; ago++) {
    const scheduledAt = new Date(minute - ago * 60_000);
    if (!scheduleMatches(expr, scheduledAt, timezone)) continue;
    const wallKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(scheduledAt);
    // No UTC offset: the repeated autumn hour is claimed once per wall-clock slot.
    return { scheduledAt, wallKey: `${timezone}:${wallKey}` };
  }
  return null;
}
