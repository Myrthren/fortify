// Whop OAuth + membership helpers
//
// IMPORTANT: Whop OAuth is IDENTITY-ONLY. The token tells you WHO the user is
// (sub = user_xxx) but carries NO membership/tier data. Tier resolution is a
// separate server-side call to /v5/app/memberships using the app API key.

import type { Tier } from "@prisma/client";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { syncTierRole } from "@/lib/discord";

const AUTHORIZE_URL = "https://api.whop.com/oauth/authorize";
const TOKEN_URL = "https://api.whop.com/oauth/token";
const USERINFO_URL = "https://api.whop.com/oauth/userinfo";
// NOTE: /v5/app/* requires an *App* API key. Our key is a company/Bot key, which
// 403s there but works fine on the v2 company-scoped endpoints. Verified 2026-07.
const MEMBERSHIPS_URL = "https://api.whop.com/v2/memberships";

const SCOPES = ["openid", "profile", "email"].join(" ");

function cfg() {
  const clientId = process.env.WHOP_CLIENT_ID;
  const redirectUri =
    process.env.WHOP_REDIRECT_URI ?? "https://fortify-io.com/api/whop/callback";
  if (!clientId) throw new Error("WHOP_CLIENT_ID not set");
  return {
    clientId,
    redirectUri,
    // Public client under PKCE — secret is optional and only sent if present.
    clientSecret: process.env.WHOP_CLIENT_SECRET,
  };
}

function appApiKey(): string {
  const key = process.env.WHOP_APP_API_KEY;
  if (!key) throw new Error("WHOP_APP_API_KEY not set");
  return key;
}

/**
 * Whop PLAN ID → Tier. Mirrors PLAN_TO_TIER in lib/tiers.ts.
 *
 * All three tiers live under ONE Whop product (prod_31wBhBvvQRh1x) as separate
 * renewal plans — so the tier is carried by the PLAN, not the product.
 */
export function planToTier(): Record<string, Tier> {
  const map: Record<string, Tier> = {};
  if (process.env.WHOP_PLAN_PRO) map[process.env.WHOP_PLAN_PRO] = "PRO";
  if (process.env.WHOP_PLAN_ELITE) map[process.env.WHOP_PLAN_ELITE] = "ELITE";
  if (process.env.WHOP_PLAN_APEX) map[process.env.WHOP_PLAN_APEX] = "APEX";
  return map;
}

// ── PKCE ───────────────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

// ── OAuth ──────────────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string, challenge: string): string {
  const { clientId, redirectUri } = cfg();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = cfg();
  const body: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  };
  if (clientSecret) body.client_secret = clientSecret;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    throw new Error(`Whop token exchange failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error("Whop token response missing access_token");
  return json.access_token as string;
}

/** Returns the Whop user id (sub, e.g. "user_xxx"). */
export async function getWhopUserId(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Whop userinfo failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  const sub = json.sub as string | undefined;
  if (!sub) throw new Error("Whop userinfo response missing sub");
  return sub;
}

// ── Memberships (app API key — NOT the OAuth token) ────────────────────────────

export type WhopMembership = { id: string; planId: string; tier: Tier };

/**
 * Look up the user's valid memberships and map them to Fortify tiers by plan id.
 * Memberships on plans we don't recognise are ignored.
 */
export async function getMemberships(whopUserId: string): Promise<WhopMembership[]> {
  const map = planToTier();
  if (Object.keys(map).length === 0) {
    console.error("[whop] no WHOP_PLAN_* env vars set — every user resolves to FREE");
    return [];
  }

  const url = `${MEMBERSHIPS_URL}?user_id=${encodeURIComponent(whopUserId)}&valid=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${appApiKey()}` } });
  if (!res.ok) {
    throw new Error(`Whop memberships lookup failed (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  const rows: any[] = json.data ?? [];
  const found: WhopMembership[] = [];
  for (const row of rows) {
    // v2 returns related records as bare id strings (e.g. plan: "plan_xxx").
    const planId: string | undefined =
      typeof row?.plan === "string" ? row.plan : row?.plan?.id ?? row?.plan_id;
    if (!planId || !map[planId] || !row?.id) continue;
    found.push({ id: row.id, planId, tier: map[planId] });
  }
  return found;
}

const TIER_RANK: Record<Tier, number> = { FREE: 0, PRO: 1, ELITE: 2, APEX: 3 };

/** Highest tier among the given memberships, or FREE if none. */
export function highestTier(memberships: WhopMembership[]): {
  tier: Tier;
  membershipId: string | null;
} {
  let best: WhopMembership | null = null;
  for (const m of memberships) {
    if (!best || TIER_RANK[m.tier] > TIER_RANK[best.tier]) best = m;
  }
  return { tier: best?.tier ?? "FREE", membershipId: best?.id ?? null };
}

// ── Webhooks (Standard Webhooks spec) ──────────────────────────────────────────

/**
 * Verify a Whop webhook (Standard Webhooks: HMAC-SHA256 over
 * "{id}.{timestamp}.{body}", compared against the `v1,<b64>` header).
 *
 * KEY DERIVATION: Whop's own SDK examples base64-ENCODE the secret before
 * handing it to the Standard Webhooks verifier (`btoa(WHOP_WEBHOOK_SECRET)`),
 * and SW verifiers base64-DECODE what they're given — so the two cancel and
 * the real HMAC key is the raw UTF-8 secret, `ws_` prefix included.
 *
 * We also try the prefix-stripped form, because Whop's docs are inconsistent
 * about whether `ws_` is part of the secret proper. Both candidates derive
 * from the same secret, so accepting either costs nothing security-wise.
 * Once a real delivery lands, check which variant the log reports and drop
 * the other.
 */
export function verifyWebhook(headers: Headers, rawBody: string): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[whop] WHOP_WEBHOOK_SECRET not set — rejecting webhook");
    return false;
  }

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !sigHeader) {
    // The dashboard's "send test webhook" button omits webhook-signature
    // entirely and sends an empty data field — a 401 here is expected for
    // test sends and does NOT mean the secret is wrong. Test with a real
    // membership event instead.
    console.error("[whop] webhook missing Standard-Webhooks headers");
    return false;
  }

  // Reject stale/replayed deliveries (5 min tolerance).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const signed = `${id}.${timestamp}.${rawBody}`;
  const candidates: Array<[string, Buffer]> = [
    ["raw", Buffer.from(secret, "utf8")],
    ["stripped", Buffer.from(secret.replace(/^ws_/, ""), "utf8")],
  ];

  // Header may carry several space-separated "v1,<sig>" versions.
  const sigs = sigHeader
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : part));

  for (const [variant, key] of candidates) {
    const expected = createHmac("sha256", key).update(signed).digest("base64");
    const b = Buffer.from(expected);
    const hit = sigs.some((sig) => {
      const a = Buffer.from(sig);
      return a.length === b.length && timingSafeEqual(a, b);
    });
    if (hit) {
      console.log(`[whop] webhook signature verified (${variant} key)`);
      return true;
    }
  }

  console.error("[whop] webhook signature mismatch — check WHOP_WEBHOOK_SECRET");
  return false;
}

/** Pull the fields we care about out of a membership webhook payload. */
export function parseMembershipEvent(data: any): {
  whopUserId: string | null;
  planId: string | null;
  membershipId: string | null;
} {
  const asId = (v: any) => (typeof v === "string" ? v : v?.id ?? null);
  return {
    whopUserId: asId(data?.user) ?? data?.user_id ?? null,
    planId: asId(data?.plan) ?? data?.plan_id ?? null,
    membershipId: data?.id ?? data?.membership_id ?? null,
  };
}

/** One-shot: resolve a Whop user id to their Fortify tier. */
export async function resolveTier(whopUserId: string) {
  return highestTier(await getMemberships(whopUserId));
}

/**
 * Apply a user's Whop membership to their Fortify account.
 * Never downgrades — an existing PayPal sub may already grant a higher tier.
 */
export async function syncWhopTier(userId: string, whopUserId: string) {
  const { tier, membershipId } = await resolveTier(whopUserId);
  if (tier === "FREE" || !membershipId) return { tier, membershipId, applied: false };

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { tier: true, discordId: true, subscription: true },
  });
  if (!me) return { tier, membershipId, applied: false };

  let applied = false;
  if (TIER_RANK[tier] > TIER_RANK[me.tier]) {
    await db.user.update({ where: { id: userId }, data: { tier } });
    if (me.discordId) await syncTierRole(me.discordId, tier);
    applied = true;
  }

  // Only record a Whop subscription if PayPal doesn't already own the row.
  if (!me.subscription) {
    await db.subscription.create({
      data: { userId, provider: "whop", whopMembershipId: membershipId, tier, status: "ACTIVE" },
    });
  } else if (me.subscription.provider === "whop") {
    await db.subscription.update({
      where: { userId },
      data: { whopMembershipId: membershipId, tier, status: "ACTIVE", cancelledAt: null },
    });
  }

  return { tier, membershipId, applied };
}

/**
 * Re-check Whop and downgrade if their membership is gone.
 *
 * Only ever touches users whose tier actually CAME from Whop — if the
 * Subscription row belongs to PayPal we leave everything alone, so a lapsed
 * Whop membership can't strip a paying PayPal customer.
 */
export async function revokeWhopTier(userId: string, whopUserId: string) {
  const { tier } = await resolveTier(whopUserId);
  if (tier !== "FREE") {
    // Still has a valid membership (e.g. downgraded, not cancelled) — re-apply.
    return syncWhopTier(userId, whopUserId);
  }

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { discordId: true, subscription: true },
  });
  if (me?.subscription?.provider !== "whop") return { revoked: false };

  await db.$transaction([
    db.subscription.update({
      where: { userId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    }),
    db.user.update({ where: { id: userId }, data: { tier: "FREE" } }),
  ]);
  if (me.discordId) await syncTierRole(me.discordId, "FREE");

  return { revoked: true };
}
