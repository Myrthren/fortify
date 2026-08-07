import { db } from "@/lib/db";

/**
 * Shared helpers for the engine stages. Kept separate so each stage file stays
 * about its own job.
 */

/** Normalise a URL to the bare host — the dedupe key for a business. */
export function toDomain(website?: string | null): string | null {
  if (!website) return null;
  try {
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

export function domainOfEmail(email?: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  return email.split("@").pop()!.toLowerCase().replace(/^www\./, "") || null;
}

/**
 * Addresses that exist to be ignored. Sending to these burns sender reputation
 * for zero chance of a reply.
 */
const ROLE_PREFIXES = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "postmaster",
  "mailer-daemon",
  "abuse",
  "spam",
  "unsubscribe",
  "privacy",
  "legal",
  "dpo",
  "webmaster",
  "hostmaster",
];

const FREE_MAIL = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "live.com",
  "protonmail.com",
];

export function isSendableEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)) return false;
  const local = e.split("@")[0];
  if (ROLE_PREFIXES.some((p) => local === p || local.startsWith(`${p}@`) || local.startsWith(`${p}.`))) {
    return false;
  }
  if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(e)) return false;
  if (/^(example|test|your|sample)@/.test(e)) return false;
  return true;
}

export function isFreeMailDomain(domain?: string | null): boolean {
  return Boolean(domain && FREE_MAIL.includes(domain));
}

/**
 * Do-not-contact check. Matches the exact address and the whole domain, so one
 * unsubscribe from a company stops every contact at that company.
 */
export async function isSuppressed(
  userId: string,
  email?: string | null,
  domain?: string | null
): Promise<boolean> {
  const values = [email?.toLowerCase(), domain?.toLowerCase(), domainOfEmail(email)].filter(
    Boolean
  ) as string[];
  if (!values.length) return false;

  const hit = await db.outboundSuppression.findFirst({
    where: { userId, value: { in: values } },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function suppress(
  userId: string,
  value: string,
  kind: "email" | "domain",
  reason: string
): Promise<void> {
  const v = value.trim().toLowerCase();
  if (!v) return;
  await db.outboundSuppression.upsert({
    where: { userId_value: { userId, value: v } },
    create: { userId, value: v, kind, reason },
    update: { reason },
  });
}

/** Append to a lead's timeline. Never throws — logging must not fail a stage. */
export async function logEvent(
  leadId: string,
  type: string,
  detail?: string | null,
  meta?: Record<string, unknown>,
  emailId?: string | null
): Promise<void> {
  try {
    await db.outboundEvent.create({
      data: {
        leadId,
        emailId: emailId ?? null,
        type,
        detail: detail?.slice(0, 4000) ?? null,
        meta: (meta ?? undefined) as never,
      },
    });
  } catch (e) {
    console.error("[outbound] failed to log event", type, e);
  }
}

/**
 * Record a stage failure against the lead. After three failures the lead is
 * disqualified rather than retried forever — a site that will not fetch on the
 * third attempt is not going to fetch on the thirtieth, and every retry costs
 * a slot in the tick budget.
 */
const MAX_ERRORS = 3;

export async function recordFailure(
  leadId: string,
  stageName: string,
  err: unknown
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const lead = await db.outboundLead.update({
    where: { id: leadId },
    data: { errorCount: { increment: 1 }, lastError: message.slice(0, 500) },
    select: { errorCount: true },
  });

  await logEvent(leadId, "error", `${stageName}: ${message}`, { stage: stageName });

  if (lead.errorCount >= MAX_ERRORS) {
    await db.outboundLead.update({
      where: { id: leadId },
      data: {
        stage: "DISQUALIFIED",
        disqualifiedReason: `Failed at ${stageName} ${lead.errorCount} times: ${message}`.slice(0, 400),
        nextActionAt: null,
      },
    });
    await logEvent(leadId, "disqualified", `Repeated failure at ${stageName}`);
  }
}

/** Simple wall-clock budget so a tick never overruns its function timeout. */
export class Budget {
  private readonly deadline: number;

  constructor(ms: number) {
    this.deadline = Date.now() + ms;
  }

  get expired(): boolean {
    return Date.now() >= this.deadline;
  }

  get remainingMs(): number {
    return Math.max(0, this.deadline - Date.now());
  }
}
