export const PLAN_KINDS = ["goal", "milestone", "task", "decision", "note", "software", "procedure", "group"] as const;
export type PlanKind = typeof PLAN_KINDS[number];
export const PLAN_STATES = ["planned", "in-progress", "done"] as const;
export type PlanState = typeof PLAN_STATES[number];
export const SOFTWARE = [
  { id: "notion", label: "Notion" }, { id: "shopify", label: "Shopify" }, { id: "stripe", label: "Stripe" },
  { id: "google", label: "Google" }, { id: "meta", label: "Meta Ads" }, { id: "discord", label: "Discord" },
] as const;
export type SoftwareId = typeof SOFTWARE[number]["id"];
export type PlanNode = { id: string; kind: PlanKind; title: string; body: string; x: number; y: number; width: number; height: number; status: PlanState; date?: string; groupId?: string; software?: SoftwareId; url?: string; workflowId?: string };
export type PlanEdge = { id: string; from: string; to: string; relation: "blocks" | "supports" | "alternative"; label: string };
export type PlanDocument = { nodes: PlanNode[]; edges: PlanEdge[]; viewport: { x: number; y: number; zoom: number } };
export type PlanSummary = { id: string; title: string; description: string; version: number; cardCount: number; doneCount: number; archived: boolean; updatedAt: string };
export type PlanRun = { id: string; nodeId: string; workflowId: string; runId: string | null; status: string; message: string | null; updatedAt: string };
export type PlanView = PlanSummary & { document: PlanDocument; runs: PlanRun[] };
export type PlanBindings = { software: { id: SoftwareId; label: string; connected: boolean; detail?: string }[]; workflows: { id: string; name: string; description: string | null; updatedAt: string; actions: string[]; lastStatus: string | null }[]; canRun: boolean };
export const emptyPlan = (): PlanDocument => ({ nodes: [], edges: [], viewport: { x: 45, y: 45, zoom: 1 } });
const id = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
function short(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw Error(`${label} must ${required ? "be present and " : ""}be under ${max + 1} characters.`);
  return value.trim();
}
function numeric(value: unknown, min: number, max: number): number { if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw Error("A canvas position or size is outside its limits."); return value; }
export function validPlanDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function planLink(value: unknown): string {
  const text = short(value, "Resource URL", 2048);
  if (!text) return "";
  let url: URL; try { url = new URL(text); } catch { throw Error("Use a full http or https resource URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("Use an http or https resource URL without embedded login details.");
  return url.toString();
}
export function parsePlanDocument(value: unknown): PlanDocument {
  if (!value || typeof value !== "object") throw Error("Invalid canvas.");
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.nodes) || raw.nodes.length > 100 || !Array.isArray(raw.edges) || raw.edges.length > 200) throw Error("A plan supports up to 100 cards and 200 connections.");
  const nodes: PlanNode[] = raw.nodes.map(item => {
    if (!item || !id(item.id) || !PLAN_KINDS.includes(item.kind) || !PLAN_STATES.includes(item.status)) throw Error("Invalid card type, status or identifier.");
    const node: PlanNode = { id: item.id, kind: item.kind, title: short(item.title, "Card title", 120, true), body: short(item.body, "Card text", 4000), status: item.status, x: numeric(item.x, 0, 10000), y: numeric(item.y, 0, 10000), width: numeric(item.width, 190, 1600), height: numeric(item.height, 145, 1600) };
    if (item.date) { if (!validPlanDate(item.date)) throw Error("Choose a valid planning date."); node.date = item.date; }
    if (item.groupId) { if (!id(item.groupId)) throw Error("Invalid phase group."); node.groupId = item.groupId; }
    if (item.software) { if (item.kind !== "software" || !SOFTWARE.some(s => s.id === item.software)) throw Error("Choose a supported software connection."); node.software = item.software; }
    if (item.url) node.url = planLink(item.url);
    if (item.workflowId) { if (item.kind !== "procedure" || !id(item.workflowId)) throw Error("Attach a valid procedure to a procedure card."); node.workflowId = item.workflowId; }
    return node;
  });
  const ids = new Set(nodes.map(n => n.id)); if (ids.size !== nodes.length) throw Error("Card identifiers must be unique.");
  for (const node of nodes) if (node.groupId && (node.kind === "group" || !nodes.some(group => group.id === node.groupId && group.kind === "group"))) throw Error("A card references an invalid phase group.");
  const edges: PlanEdge[] = raw.edges.map(item => {
    if (!item || !id(item.id) || !ids.has(item.from) || !ids.has(item.to) || item.from === item.to || !["blocks", "supports", "alternative"].includes(item.relation)) throw Error("A connection must join two different cards and have a relationship.");
    if (nodes.some(n => [item.from, item.to].includes(n.id) && n.kind === "group")) throw Error("Connect individual cards inside a phase group.");
    return { id: item.id, from: item.from, to: item.to, relation: item.relation, label: short(item.label, "Connection label", 100) };
  });
  if (new Set(edges.map(e => e.id)).size !== edges.length || new Set(edges.map(e => `${e.from}:${e.to}:${e.relation}`)).size !== edges.length) throw Error("Connections must be unique.");
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(nodeId: string) { if (visiting.has(nodeId)) throw Error("Blocking dependencies cannot form a loop. Use a supporting or alternative connection for a feedback loop."); if (visited.has(nodeId)) return; visiting.add(nodeId); for (const edge of edges.filter(e => e.from === nodeId && e.relation === "blocks")) visit(edge.to); visiting.delete(nodeId); visited.add(nodeId); }
  nodes.forEach(node => visit(node.id));
  const vp = raw.viewport as Record<string, unknown> | undefined;
  return { nodes, edges, viewport: { x: numeric(vp?.x ?? 45, -20000, 20000), y: numeric(vp?.y ?? 45, -20000, 20000), zoom: numeric(vp?.zoom ?? 1, 0.2, 2) } };
}
export function planCounts(document: PlanDocument) { const cards = document.nodes.filter(n => !["note", "software", "group"].includes(n.kind)); return { cardCount: cards.length, doneCount: cards.filter(n => n.status === "done").length }; }
export function planReadiness(document: PlanDocument, nodeId: string, today = new Date().toISOString().slice(0, 10)) {
  const node = document.nodes.find(n => n.id === nodeId);
  if (!node) return { ready: false, reason: "Card not found.", blockers: [] as string[] };
  const blockers = document.edges.filter(e => e.to === nodeId && e.relation === "blocks").map(e => document.nodes.find(n => n.id === e.from)).filter(n => n && n.status !== "done").map(n => n!.title);
  if (blockers.length) return { ready: false, reason: `Waiting for ${blockers.join(", ")}.`, blockers };
  if (node.kind === "procedure" && node.date && node.date > today) return { ready: false, reason: `Planned for ${node.date}.`, blockers };
  if (node.status === "done") return { ready: false, reason: "This step is already complete.", blockers };
  return { ready: true, reason: node.kind === "procedure" ? "Prerequisites are complete and this procedure can be reviewed." : "No unfinished prerequisites.", blockers };
}
export function exportJsonCanvas(document: PlanDocument) {
  return {
    nodes: document.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height,
      ...(n.kind === "group" ? { type: "group", label: n.title } : { type: "text", text: `# ${n.title}\n\n${n.body}${n.url ? `\n\n[Open resource](${n.url})` : ""}` }), fortify: { kind: n.kind, status: n.status, date: n.date, groupId: n.groupId } })),
    edges: document.edges.map(e => ({ id: e.id, fromNode: e.from, fromSide: "right", toNode: e.to, toSide: "left", toEnd: "arrow", label: e.label || e.relation })),
  };
}
export function planStarter(kind: unknown): PlanDocument {
  if (kind === "blank") return emptyPlan();
  if (typeof kind !== "string" || !["launch", "growth"].includes(kind)) throw Error("Choose a valid plan template.");
  const node = (id: string, type: PlanKind, title: string, x: number, y: number, body = ""): PlanNode => ({ id, kind: type, title, body, x, y, width: 265, height: 185, status: "planned" });
  const nodes = kind === "launch" ? [node("goal", "goal", "Launch a new offer", 50, 60, "Define the result you want and how you will measure it."), node("research", "task", "Understand the audience", 390, 60), node("decision", "decision", "Choose the offer", 730, 60, "Record the options, evidence and your decision."), node("draft", "task", "Prepare launch materials", 1070, 60), node("launch", "milestone", "Ready to launch", 1070, 350), node("procedure", "procedure", "Launch procedure", 730, 350, "Attach a saved Fortify workflow when the plan is ready."), node("learn", "milestone", "Review real results", 390, 350), node("resource", "software", "Supporting workspace", 50, 350, "Link the software and source material used for this plan.")] : [node("goal", "goal", "Grow the next 90 days", 50, 80), node("audience", "task", "Choose a customer segment", 390, 80), node("leads", "task", "Build a focused prospect list", 730, 80), node("outreach", "procedure", "Outreach preparation", 1070, 80, "Attach a procedure to prepare drafts for your review."), node("review", "milestone", "Review progress and adjust", 1070, 380)];
  const pairs = kind === "launch" ? [["research", "decision"], ["decision", "draft"], ["draft", "launch"], ["launch", "procedure"], ["procedure", "learn"]] : [["audience", "leads"], ["leads", "outreach"], ["outreach", "review"]];
  return { nodes, edges: pairs.map(([from, to], i) => ({ id: `edge${i}`, from, to, relation: "blocks", label: "Requires completion" })), viewport: { x: 35, y: 45, zoom: 0.72 } };
}
