/**
 * Simple sliding-window in-memory rate limiter.
 * Works per-instance (adequate for low-traffic serverless; swap for
 * @upstash/ratelimit + Redis for multi-instance production scale).
 */

interface Entry {
  count: number;
  reset: number; // epoch ms when the window resets
}

const store = new Map<string, Entry>();

/** Prune stale entries to prevent unbounded growth. */
function prune(now: number) {
  if (store.size < 5_000) return;
  for (const [k, v] of store) {
    if (now > v.reset) store.delete(k);
  }
}

/**
 * @param key       Unique key, e.g. `"recon:${userId}"`
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window length in milliseconds
 * @returns `ok: false` when the limit is exceeded
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  prune(now);

  const entry = store.get(key);

  if (!entry || now > entry.reset) {
    const resetMs = now + windowMs;
    store.set(key, { count: 1, reset: resetMs });
    return { ok: true, remaining: limit - 1, resetMs };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetMs: entry.reset };
  }

  entry.count++;
  return { ok: true, remaining: limit - entry.count, resetMs: entry.reset };
}

/** Helper: returns a 429 Response with Retry-After header. */
export function rateLimitResponse(resetMs: number): Response {
  const retryAfter = Math.ceil((resetMs - Date.now()) / 1000);
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
    },
  });
}
