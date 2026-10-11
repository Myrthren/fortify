import test from "node:test";
import assert from "node:assert/strict";
import { getShopifyData, getRevenueForPeriod } from "../lib/shopify.ts";
import { getStripeData } from "../lib/stripe-intel.ts";

function json(body, headers = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });
}

test("Shopify aggregates every order page instead of truncating after 250", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("orders.json") && !url.includes("page_info")) {
      return json({ orders: [{ id: 1, total_price: "10", created_at: "", financial_status: "paid", line_items: [] }] }, {
        link: '<https://demo.myshopify.com/admin/api/2026-10/orders.json?page_info=next>; rel="next"',
      });
    }
    if (url.includes("page_info=next")) return json({ orders: [{ id: 2, total_price: "15", created_at: "", financial_status: "paid", line_items: [] }] });
    if (url.includes("customers/count")) return json({ count: 4 });
    if (url.includes("products/count")) return json({ count: 3 });
    if (url.includes("shop.json")) return json({ shop: { currency: "USD" } });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const data = await getShopifyData("demo.myshopify.com", "token", 30);
    assert.equal(data.revenue, 25);
    assert.equal(data.orderCount, 2);
    const period = await getRevenueForPeriod("demo.myshopify.com", "token", new Date("2026-01-01"));
    assert.equal(period.orderCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Stripe reads all pages and calculates quantity-aware MRR", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/balance")) return json({ available: [{ amount: 5000, currency: "usd" }], pending: [] });
    if (url.pathname.endsWith("/charges")) {
      return url.searchParams.get("starting_after")
        ? json({ data: [{ id: "ch_2", amount: 3000, currency: "usd", created: 2, status: "succeeded", description: null }], has_more: false })
        : json({ data: [{ id: "ch_1", amount: 2000, currency: "usd", created: 1, status: "succeeded", description: null }], has_more: true });
    }
    if (url.pathname.endsWith("/subscriptions")) return json({ data: [{ id: "sub_1", status: "active", items: { data: [{ quantity: 2, price: { unit_amount: 1500, currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] } }], has_more: false });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const data = await getStripeData("sk_test_example");
    assert.equal(data.revenue30d, 50);
    assert.equal(data.chargeCount30d, 2);
    assert.equal(data.mrr, 30);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Stripe rejects mixed currencies rather than reporting a false total", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/balance")) return json({ available: [{ amount: 5000, currency: "usd" }], pending: [] });
    if (url.pathname.endsWith("/charges")) return json({ data: [{ id: "ch_1", amount: 2000, currency: "eur", created: 1, status: "succeeded", description: null }], has_more: false });
    if (url.pathname.endsWith("/subscriptions")) return json({ data: [], has_more: false });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    await assert.rejects(() => getStripeData("sk_test_example"), /multiple currencies/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
