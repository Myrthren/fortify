import { resolveMx, resolve4, resolve6 } from "node:dns/promises";

export type ContactResult = { email: string; status: "invalid" | "domain_only" | "deliverable" | "catch_all" | "disposable" | "unknown" | "pending" | "restricted";
  provider: "syntax" | "dns" | "hunter"; checkedAt: string; providerCheckedAt?: string; reason: string };
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(email) || email.includes("..")) return null;
  const [local, domain] = email.split("@");
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || domain.split(".").some(label => label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return null;
  return email;
}
export function mailboxVerdict(raw: unknown, email: string, now: Date): ContactResult {
  const base: ContactResult = { email, status: "unknown", provider: "hunter", checkedAt: now.toISOString(), reason: "The provider could not establish this mailbox's deliverability." };
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, any>;
  if (typeof data.email !== "string" || data.email.toLowerCase() !== email) return base;
  if (data.disposable === true || data.status === "disposable") return { ...base, status: "disposable", reason: "Disposable mailbox; hold for review." };
  if (data.accept_all === true || data.status === "accept_all") return { ...base, status: "catch_all", reason: "The domain accepts arbitrary addresses; this mailbox is not proven valid." };
  if (data.status === "invalid") return { ...base, status: "invalid", reason: "Provider reports the address invalid." };
  const checked = data.verification?.date;
  const age = typeof checked === "string" ? now.getTime() - Date.parse(checked) : Infinity;
  if (age >= 0 && age <= 31 * 24 * 60 * 60_000 && data.smtp_check === true && data.block !== true && data.accept_all === false && ["valid", "webmail"].includes(data.status)) {
    return { ...base, status: "deliverable", providerCheckedAt: checked, reason: "Provider reports a successful mailbox check. This is not a delivery guarantee or permission to contact." };
  }
  return base;
}

const dnsTimeout = async <T>(operation: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DNS timeout")), 4000); })]); }
  finally { if (timer) clearTimeout(timer); }
};
export async function verifyContact(raw: string): Promise<ContactResult> {
  const now = new Date(), email = normaliseEmail(raw);
  if (!email) return { email: String(raw).slice(0, 254), status: "invalid", provider: "syntax", checkedAt: now.toISOString(), reason: "Invalid email syntax." };
  let domainState: "mail" | "none" | "unknown" = "unknown";
  try {
    const domain = email.split("@")[1];
    const records = await dnsTimeout(resolveMx(domain));
    if (records.some((record) => record.exchange === "." || (record.exchange === "" && record.priority === 0))) domainState = "none";
    else if (records.length) domainState = "mail";
    else {
      const addresses = await dnsTimeout(Promise.allSettled([resolve4(domain), resolve6(domain)]));
      domainState = addresses.some((result) => result.status === "fulfilled" && result.value.length) ? "mail" : "none";
    }
  } catch (error) {
    const code = (error as any)?.code;
    if (code === "ENOTFOUND") domainState = "none";
    else if (code === "ENODATA") {
      // RFC implicit-MX fallback; missing MX alone does not prove an invalid domain.
      const addresses = await dnsTimeout(Promise.allSettled([resolve4(email.split("@")[1]), resolve6(email.split("@")[1])])).catch(() => []);
      domainState = addresses.some((result) => result.status === "fulfilled" && result.value.length) ? "mail" : "unknown";
    }
  }
  if (domainState === "none") return { email, status: "invalid", provider: "dns", checkedAt: now.toISOString(), reason: "Domain has no usable mail service or explicitly rejects mail." };
  const key = process.env.HUNTER_API_KEY;
  if (process.env.EMAIL_VERIFICATION_ENABLED !== "true" || !key || key === "test-api-key") return { email, status: domainState === "mail" ? "domain_only" : "unknown", provider: "dns", checkedAt: now.toISOString(), reason: domainState === "mail" ? "Mail-capable domain only. Mailbox verification is not configured; the individual address remains unverified." : "Domain check inconclusive; mailbox verification is not configured." };
  try {
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}`, {
      headers: { "X-API-KEY": key }, signal: AbortSignal.timeout(25_000), redirect: "error",
    });
    if (res.status === 202) return { email, status: "pending", provider: "hunter", checkedAt: now.toISOString(), reason: "Provider is still checking; retry later. Not verified yet." };
    if (res.status === 451) return { email, status: "restricted", provider: "hunter", checkedAt: now.toISOString(), reason: "Provider has a privacy restriction; do not process or contact this address." };
    if (!res.ok) return { email, status: "unknown", provider: "hunter", checkedAt: now.toISOString(), reason: "Mailbox provider unavailable, limited or not authorised. Hold the address." };
    return mailboxVerdict((await res.json())?.data, email, now);
  } catch {
    return { email, status: "unknown", provider: "hunter", checkedAt: now.toISOString(), reason: "Mailbox check timed out or failed; no verification established." };
  }
}
