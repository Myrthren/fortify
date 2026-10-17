// When a PayPal subscription is cancelled, the member keeps their tier until
// the end of the month they already paid for. This works out that date.
//
// Sources, most reliable first:
//   1. PayPal's own next_billing_time (often still present right after cancel)
//   2. the nextBillingAt we stored at activation or on an earlier event
//   3. the last payment + one month (our plans bill monthly)
// Returns null when none of them is in the future, which means downgrade now.
export function paidThrough(
  paypalSub: { billing_info?: { next_billing_time?: string; last_payment?: { time?: string } } } | null,
  storedNextBillingAt: Date | null,
  now: Date = new Date(),
): Date | null {
  const candidates: (Date | null)[] = [
    toDate(paypalSub?.billing_info?.next_billing_time),
    storedNextBillingAt,
    addMonth(toDate(paypalSub?.billing_info?.last_payment?.time)),
  ];
  for (const d of candidates) if (d && d.getTime() > now.getTime()) return d;
  return null;
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonth(d: Date | null): Date | null {
  if (!d) return null;
  const next = new Date(d);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export function formatAccessDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
