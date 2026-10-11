import crypto from "node:crypto";

const MAX_AGE_MS = 10 * 60 * 1000;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET not set");
  return value;
}

export function createOAuthState(userId: string, provider: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, provider, issuedAt: Date.now(), nonce: crypto.randomBytes(12).toString("hex") })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state: string | null, userId: string, provider: string): boolean {
  if (!state) return false;
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return false;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return value.userId === userId && value.provider === provider && Number.isFinite(value.issuedAt) && Date.now() - value.issuedAt <= MAX_AGE_MS;
  } catch { return false; }
}
