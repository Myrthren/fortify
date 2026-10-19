import test from "node:test";
import assert from "node:assert/strict";
import { leadKey, packDue, pickNewLeads, weekStart } from "../lib/lead-pack-core.ts";

const at = (iso) => new Date(iso);

test("weekStart is the latest Monday 06:00 UTC", () => {
  assert.equal(weekStart(at("2026-10-19T09:00:00Z")).toISOString(), "2026-10-19T06:00:00.000Z"); // Monday after 06:00
  assert.equal(weekStart(at("2026-10-19T05:00:00Z")).toISOString(), "2026-10-12T06:00:00.000Z"); // Monday before 06:00
  assert.equal(weekStart(at("2026-10-25T23:00:00Z")).toISOString(), "2026-10-19T06:00:00.000Z"); // Sunday
});

test("first pack is due straight away", () => {
  assert.equal(packDue(null, at("2026-10-21T12:00:00Z")), true);
});

test("one pack per week, released on Monday morning", () => {
  const firstPack = at("2026-10-21T12:00:00Z"); // set up on a Wednesday
  assert.equal(packDue(firstPack, at("2026-10-25T20:00:00Z")), false); // same week
  assert.equal(packDue(firstPack, at("2026-10-26T05:59:00Z")), false); // Monday, too early
  assert.equal(packDue(firstPack, at("2026-10-26T06:00:00Z")), true);  // Monday 06:00
  assert.equal(packDue(at("2026-10-26T06:15:00Z"), at("2026-10-28T10:00:00Z")), false); // already delivered this week
});

test("pickNewLeads skips closed places and earlier deliveries, and caps the size", () => {
  const seen = new Set([leadKey({ title: "Old Dental", address: "1 High St" })]);
  const items = [
    { title: "Old Dental", address: "1 High St" },
    { title: "Closed Smiles", address: "2 High St", permanentlyClosed: true },
    { title: "Paused Teeth", address: "3 High St", temporarilyClosed: true },
    { address: "no title" },
    { title: "New Dental", address: "4 High St", website: "https://new.example", totalScore: 4.8, reviewsCount: 12, emails: ["hi@new.example"] },
    { title: "new dental ", address: " 4 high st" }, // same place, different spacing
    { title: "Third Clinic", address: "5 High St" },
    { title: "Fourth Clinic", address: "6 High St" },
  ];
  const leads = pickNewLeads(items, seen, 2);
  assert.deepEqual(leads.map((l) => l.title), ["New Dental", "Third Clinic"]);
  assert.equal(leads[0].url, "https://new.example");
  assert.deepEqual(leads[0].emails, ["hi@new.example"]);
  assert.equal(leads[1].emails, undefined);
  assert.ok(seen.has(leadKey({ title: "Third Clinic", address: "5 High St" })), "picked leads are added to seen");
});
