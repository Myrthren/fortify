import type { DiscoveredBusiness } from "./types";
export type LeadQualification = { eligible: boolean; reason?: string; domain: string | null; email: string | null };
export function normaliseLead(b: DiscoveredBusiness): DiscoveredBusiness {
  return { ...b, company: b.company.trim().replace(/\s+/g, " ").slice(0, 200), website: b.website?.trim().replace(/\/+$/, "") || null, email: b.email?.trim().toLowerCase() || null };
}
export function qualifyLead(b: DiscoveredBusiness, domain: string | null): LeadQualification {
  const email = b.email?.trim().toLowerCase() || null;
  if (!b.company.trim()) return { eligible: false, reason: "missing company name", domain, email };
  if (!domain) return { eligible: false, reason: "no company website or domain", domain, email };
  if (email && (!email.includes("@") || /^(info|hello|contact|admin|support)@/i.test(email))) return { eligible: false, reason: "generic or invalid contact email", domain, email };
  return { eligible: true, domain, email };
}
