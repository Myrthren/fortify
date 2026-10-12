import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { normaliseEmail, verifyContact } from "@/lib/contact-verification";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({ where: { id: userId }, select: { tier: true } });
  if (!user || user.tier === "FREE") return NextResponse.json({ error: "Contact checks require Pro or above" }, { status: 403 });
  const rate = rateLimit(`contact-check:${userId}`, 3, 60_000);
  if (!rate.ok) return rateLimitResponse(rate.resetMs);
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.emails) || !body.emails.length || body.emails.length > 5 || !body.emails.every((email: unknown) => normaliseEmail(email))) return NextResponse.json({ error: "Provide one to five valid email addresses" }, { status: 400 });
  const emails = [...new Set<string>(body.emails.map(normaliseEmail))];
  const results = await Promise.all(emails.map(async (email) => {
    const saved = await db.contactCheck.findUnique({ where: { userId_email: { userId, email } } });
    if (saved && saved.expiresAt > new Date() && saved.status !== "pending" &&
      (saved.provider === "hunter" || process.env.EMAIL_VERIFICATION_ENABLED !== "true")) return saved.evidence;
    const result = await verifyContact(email);
    const expiresAt = new Date(Date.now() + (["unknown", "pending"].includes(result.status) ? 5 * 60_000 : 24 * 60 * 60_000));
    await db.contactCheck.upsert({ where: { userId_email: { userId, email } },
      create: { userId, email, status: result.status, provider: result.provider, evidence: result, expiresAt },
      update: { status: result.status, provider: result.provider, evidence: result, checkedAt: new Date(), expiresAt } });
    return result;
  }));
  return NextResponse.json({ results, mailboxProviderConfigured: process.env.EMAIL_VERIFICATION_ENABLED === "true" && !!process.env.HUNTER_API_KEY && process.env.HUNTER_API_KEY !== "test-api-key",
    notice: "Verification does not establish buying intent, consent or inbox placement." });
}
