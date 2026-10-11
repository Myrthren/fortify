import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = "test-only-oauth-state-secret";
const { createOAuthState, verifyOAuthState } = await import("../lib/oauth-state.ts");

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
