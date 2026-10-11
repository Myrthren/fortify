import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = "test-only-oauth-state-secret";
const { createOAuthState, verifyOAuthState } = await import("../lib/oauth-state.ts");
const { scoreTrend } = await import("../lib/trend-scoring.ts");

test("OAuth state is bound to user and provider", () => {
  const state = createOAuthState("user-1", "notion");
  assert.equal(verifyOAuthState(state, "user-1", "notion"), true);
  assert.equal(verifyOAuthState(state, "user-2", "notion"), false);
  assert.equal(verifyOAuthState(state, "user-1", "google"), false);
});

test("OAuth state rejects tampering and malformed values", () => {
  const state = createOAuthState("user-1", "meta");
  assert.equal(verifyOAuthState(`${state.slice(0, -1)}x`, "user-1", "meta"), false);
  assert.equal(verifyOAuthState("not-a-state", "user-1", "meta"), false);
  assert.equal(verifyOAuthState(null, "user-1", "meta"), false);
});

test("trend scoring rewards relevant and recent evidence", () => {
  const recentRelevant = scoreTrend("creator economy", {
    title: "Creator economy report",
    description: "New creator tools are gaining adoption.",
    age: "2 hours ago",
  });
  const staleIrrelevant = scoreTrend("creator economy", {
    title: "Quarterly infrastructure notes",
    description: "A general retrospective.",
    age: "2 years ago",
  });

  assert.equal(recentRelevant.relevance, 100);
  assert.ok(recentRelevant.freshness > staleIrrelevant.freshness);
  assert.ok(recentRelevant.opportunity > staleIrrelevant.opportunity);
});
