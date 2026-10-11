// Stripe REST API helpers (no SDK — direct fetch)
// Requires a restricted key with: charges:read, customers:read, subscriptions:read, balance:read

const STRIPE_BASE = "https://api.stripe.com/v1";

async function stripeFetch<T>(apiKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${STRIPE_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Stripe ${path}: ${(err as any)?.error?.message ?? res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type StripeBalance = {
  available: { amount: number; currency: string }[];
  pending:   { amount: number; currency: string }[];
};

type StripeCharge = {
  id: string;
  amount: number;
  amount_refunded?: number;
  currency: string;
  created: number;
  status: string;
  description: string | null;
};

type StripeSubscription = {
  id: string;
  status: string;
  items: { data: { quantity: number | null; price: { unit_amount: number | null; currency: string; recurring: { interval: string; interval_count: number } | null } }[] };
};

type StripeList<T> = { data: T[]; has_more: boolean };

export type StripeData = {
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  revenue30d: number;
  chargeCount30d: number;
  mrr: number;
  activeSubscriptions: number;
  recentCharges: { amount: number; currency: string; created: number; description: string | null }[];
};

function onlyCurrency(values: { currency: string }[], label: string): string {
  const currencies = [...new Set(values.map((value) => value.currency.toLowerCase()))];
  if (currencies.length > 1) throw new Error(`Stripe ${label} contains multiple currencies (${currencies.join(", ")}); Fortify cannot combine them safely.`);
  return currencies[0] ?? "usd";
}

async function stripeListAll<T extends { id: string }>(apiKey: string, path: string, params: Record<string, string>): Promise<T[]> {
  const result: T[] = [];
  let startingAfter: string | undefined;
  do {
    const page = await stripeFetch<StripeList<T>>(apiKey, path, {
      ...params,
      limit: "100",
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    result.push(...page.data);
    startingAfter = page.has_more && page.data.length ? page.data[page.data.length - 1].id : undefined;
  } while (startingAfter);
  return result;
}

export async function getStripeData(apiKey: string): Promise<StripeData> {
  const since30d = Math.floor((Date.now() - 30 * 86400000) / 1000).toString();

  const [balance, charges, subs] = await Promise.all([
    stripeFetch<StripeBalance>(apiKey, "/balance"),
    stripeListAll<StripeCharge>(apiKey, "/charges", {
      "created[gte]": since30d,
    }),
    stripeListAll<StripeSubscription>(apiKey, "/subscriptions", {
      status: "active",
    }),
  ]);

  // Balance
  const currency = onlyCurrency([...balance.available, ...balance.pending, ...charges], "data");
  const availableBalance = balance.available.reduce((s, b) => s + b.amount, 0) / 100;
  const pendingBalance = balance.pending.reduce((s, b) => s + b.amount, 0) / 100;

  // Charges (last 30d)
  const successfulCharges = charges.filter((c) => c.status === "succeeded");
  const netChargeAmount = (charge: StripeCharge) =>
    Math.max(0, charge.amount - (charge.amount_refunded ?? 0));
  const revenue30d =
    successfulCharges.reduce((sum, charge) => sum + netChargeAmount(charge), 0) /
    100;
  const chargeCount30d = successfulCharges.length;
  const recentCharges = successfulCharges.slice(0, 10).map((c) => ({
    amount: netChargeAmount(c) / 100,
    currency: c.currency,
    created: c.created,
    description: c.description,
  }));

  // MRR from active subscriptions
  const activeSubscriptions = subs.length;
  const mrr = subs.reduce((sum, sub) => {
    for (const item of sub.items.data) {
      const price = item.price;
      if (price.currency.toLowerCase() !== currency) {
        throw new Error(`Stripe subscriptions contain ${price.currency} but the account data is ${currency}; Fortify cannot combine currencies safely.`);
      }
      const amount = (price.unit_amount ?? 0) * (item.quantity ?? 1);
      const interval = price.recurring?.interval;
      const intervalCount = price.recurring?.interval_count ?? 1;
      if (interval === "month") sum += amount / 100 / intervalCount;
      else if (interval === "year") sum += amount / 100 / (12 * intervalCount);
      else if (interval === "week") sum += amount / 100 * 52 / (12 * intervalCount);
      else if (interval === "day") sum += amount / 100 * 365.25 / (12 * intervalCount);
    }
    return sum;
  }, 0);

  return { availableBalance, pendingBalance, currency, revenue30d, chargeCount30d, mrr, activeSubscriptions, recentCharges };
}

/** Verify key is valid by hitting /balance */
export async function verifyStripeKey(apiKey: string): Promise<void> {
  await stripeFetch(apiKey, "/balance");
}
