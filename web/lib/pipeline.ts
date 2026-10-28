export const PIPELINE_STAGES = [
  { value: "new", label: "Found" },
  { value: "qualified", label: "Qualified" },
  { value: "draft-ready", label: "Draft ready" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "meeting-booked", label: "Call booked" },
  { value: "won", label: "Won" },
  { value: "dead", label: "Lost" },
] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number]["value"];
export const CLOSED_STAGES = ["won", "dead"];
export const isPipelineStage = (value: unknown): value is PipelineStage => PIPELINE_STAGES.some(stage => stage.value === value);
export const stageLabel = (value: string) => PIPELINE_STAGES.find(stage => stage.value === value)?.label ?? value;
export type PipelineLead = {
  id: string; url: string; status: string; company: string | null; source: string;
  context: string | null; email: string | null; draft: string | null; draftChannel: string | null;
  notes: string; followUpAt: string | null; createdAt: string; updatedAt: string;
};
export type LeadInput = { url: string; company: string; source: string; context?: string; email?: string; draft?: string };

export function leadUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Enter a valid website or profile URL.");
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { throw new Error("Enter a full website or profile URL, starting with https://."); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname.includes(".")) throw new Error("Use a public http or https URL without login details.");
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) parsed.searchParams.delete(key);
  return parsed.toString();
}

function text(value: unknown, name: string, max: number, required = false): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new Error(`${name} ${required ? "is required and " : ""}must be under ${max + 1} characters.`);
  return value.trim();
}

export function parseLeadInput(body: Record<string, unknown>): LeadInput {
  const source = body.source ?? "manual";
  if (!["manual", "recon", "lead-sourcing", "lead-extractor", "weekly-pack"].includes(source as string)) throw new Error("Unknown lead source.");
  const email = text(body.email, "Email", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return { url: leadUrl(body.url), company: text(body.company, "Business or contact name", 160, true)!, source: source as string,
    context: text(body.context, "Research", 6000), email, draft: text(body.draft, "Draft", 16000) || undefined };
}

export function parseLeadUpdate(body: Record<string, unknown>) {
  const data: { status?: PipelineStage; notes?: string; followUpAt?: Date | null; company?: string; email?: string; draft?: string | null } = {};
  if ("status" in body) { if (!isPipelineStage(body.status)) throw new Error("Choose a valid pipeline stage."); data.status = body.status; }
  for (const [key, label, max] of [["notes", "Notes", 6000], ["company", "Business name", 160], ["draft", "Draft", 16000], ["email", "Email", 254]] as const) {
    if (key in body) data[key] = text(body[key], label, max, key === "company");
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error("Enter a valid email address.");
  if (data.draft === "") data.draft = null;
  if ("followUpAt" in body) {
    if (body.followUpAt === null || body.followUpAt === "") data.followUpAt = null;
    else {
      if (typeof body.followUpAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.followUpAt)) throw new Error("Choose a valid follow-up date.");
      const date = new Date(`${body.followUpAt}T00:00:00.000Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== body.followUpAt) throw new Error("Choose a valid follow-up date.");
      data.followUpAt = date;
    }
  }
  if (!Object.keys(data).length) throw new Error("No changes were supplied.");
  return data;
}

export function dueToday(date: string | null, status: string, now = new Date()): boolean {
  return !!date && !CLOSED_STAGES.includes(status) && date.slice(0, 10) <= now.toISOString().slice(0, 10);
}

export function prospectContext(lead: Pick<PipelineLead, "company" | "url" | "context" | "email">): string {
  return [`Business or contact: ${lead.company || new URL(lead.url).hostname}.`, `Website or profile: ${lead.url}.`, lead.email ? `Contact email: ${lead.email}.` : "", lead.context ?? ""].filter(Boolean).join("\n");
}
