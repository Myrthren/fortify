export type ScoredLead = {
  company: string; website: string; fitScore: number; fitReason: string; hook: string;
  sourceUrl: string; sourceExcerpt: string; researchedAt: string;
  verification: "discovered_unverified";
};

export function parseLeadRequest(body: unknown): { icp: string; location: string; signal: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const data = body as Record<string, unknown>;
  if (typeof data.icp !== "string" || data.icp.trim().length < 5 || data.icp.trim().length > 200) return null;
  for (const key of ["location", "signal"]) {
    if (data[key] !== undefined && (typeof data[key] !== "string" || (data[key] as string).trim().length > 80)) return null;
  }
  return { icp: data.icp.trim(), location: (data.location as string | undefined)?.trim() ?? "", signal: (data.signal as string | undefined)?.trim() ?? "" };
}

/** Only accept well-formed entries whose URLs actually appeared in the research. */
export function validateLeadResults(raw: unknown, sources: { url: string; description: string }[], researchedAt: string): ScoredLead[] {
  if (!Array.isArray(raw)) throw new Error("Lead research returned an invalid result");
  const byUrl = new Map(sources.map((source) => [source.url, source]));
  const seen = new Set<string>();
  const leads: ScoredLead[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") continue;
    const lead = candidate as Record<string, unknown>;
    if (!["company", "website", "fitReason", "hook"].every((key) => typeof lead[key] === "string" && (lead[key] as string).trim())) continue;
    if (typeof lead.fitScore !== "number" || !Number.isFinite(lead.fitScore) || lead.fitScore < 1 || lead.fitScore > 10) continue;
    const website = (lead.website as string).trim();
    const source = byUrl.get(website);
    if (!source || seen.has(website)) continue;
    try { if (!["https:", "http:"].includes(new URL(website).protocol)) continue; } catch { continue; }
    seen.add(website);
    leads.push({ company: (lead.company as string).trim().slice(0, 200), website,
      fitScore: lead.fitScore, fitReason: (lead.fitReason as string).trim().slice(0, 1000),
      hook: (lead.hook as string).trim().slice(0, 1000), sourceUrl: website,
      sourceExcerpt: source.description.slice(0, 1200), researchedAt, verification: "discovered_unverified" });
    if (leads.length === 8) break;
  }
  return leads;
}
