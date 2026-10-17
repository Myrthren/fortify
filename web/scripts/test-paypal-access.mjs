import test from "node:test";
import assert from "node:assert/strict";
import { paidThrough } from "../lib/paypal-access.ts";

const now = new Date("2026-10-17T12:00:00Z");

test("uses PayPal's next billing time when it is in the future", () => {
  const d = paidThrough({ billing_info: { next_billing_time: "2026-11-02T10:00:00Z" } }, null, now);
  assert.equal(d?.toISOString(), "2026-11-02T10:00:00.000Z");
});

test("falls back to the stored next billing date", () => {
  const stored = new Date("2026-10-30T00:00:00Z");
  assert.equal(paidThrough({ billing_info: {} }, stored, now)?.toISOString(), stored.toISOString());
  assert.equal(paidThrough(null, stored, now)?.toISOString(), stored.toISOString());
});

test("falls back to last payment plus one month", () => {
  const d = paidThrough({ billing_info: { last_payment: { time: "2026-10-05T09:00:00Z" } } }, null, now);
  assert.equal(d?.toISOString(), "2026-11-05T09:00:00.000Z");
});

test("skips past dates and moves on to the next source", () => {
  const d = paidThrough(
    { billing_info: { next_billing_time: "2026-10-01T00:00:00Z", last_payment: { time: "2026-10-10T00:00:00Z" } } },
    new Date("2026-09-01T00:00:00Z"),
    now,
  );
  assert.equal(d?.toISOString(), "2026-11-10T00:00:00.000Z");
});

test("returns null when nothing is in the future, so access ends now", () => {
  assert.equal(paidThrough({ billing_info: { last_payment: { time: "2026-08-01T00:00:00Z" } } }, null, now), null);
  assert.equal(paidThrough(null, null, now), null);
  assert.equal(paidThrough({ billing_info: { next_billing_time: "not a date" } }, null, now), null);
});
