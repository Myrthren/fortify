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
  amount: number;
  currency: string;
  created: number;
  status: string;
  description: string | null;
};

type StripeSubscription = {
  status: string;
  items: { data: { price: { unit_amount: number | null; currency: string; recurring: { interval: string } | null } }[] };
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

export async function getStripeData(apiKey: string): Promise<StripeData> {
  const since30d = Math.floor((Date.now() - 30 * 86400000) / 1000).toString();

  const [balanceRes, chargesRes, subsRes] = await Promise.allSettled([
    stripeFetch<StripeBalance>(apiKey, "/balance"),
    stripeFetch<StripeList<StripeCharge>>(apiKey, "/charges", {
      "created[gte]": since30d,
      limit: "100",
    }),
    stripeFetch<StripeList<StripeSubscription>>(apiKey, "/subscriptions", {
      status: "active",
      limit: "100",
    }),
  ]);

  // Balance
  const balance = balanceRes.status === "fulfilled" ? balanceRes.value : null;
  const currency = balance?.available?.[0]?.currency ?? "usd";
  const availableBalance = (balance?.available ?? []).reduce((s, b) => s + b.amount, 0) / 100;
  const pendingBalance = (balance?.pending ?? []).reduce((s, b) => s + b.amount, 0) / 100;

  // Charges (last 30d)
  const charges = chargesRes.status === "fulfilled"
    ? chargesRes.value.data.filter((c) => c.status === "succeeded")
    : [];
  const revenue30d = charges.reduce((s, c) => s + c.amount, 0) / 100;
  const chargeCount30d = charges.length;
  const recentCharges = charges.slice(0, 10).map((c) => ({
    amount: c.amount / 100,
    currency: c.currency,
    created: c.created,
    description: c.description,
  }));

  // MRR from active subscriptions
  const subs = subsRes.status === "fulfilled" ? subsRes.value.data : [];
  const activeSubscriptions = subs.length;
  const mrr = subs.reduce((sum, sub) => {
    for (const item of sub.items.data) {
      const price = item.price;
      const amount = price.unit_amount ?? 0;
      const interval = price.recurring?.interval;
      if (interval === "month") sum += amount / 100;
      else if (interval === "year") sum += amount / 100 / 12;
    }
    return sum;
  }, 0);

  return { availableBalance, pendingBalance, currency, revenue30d, chargeCount30d, mrr, activeSubscriptions, recentCharges };
}

/** Verify key is valid by hitting /balance */
export async function verifyStripeKey(apiKey: string): Promise<void> {
  await stripeFetch(apiKey, "/balance");
}
