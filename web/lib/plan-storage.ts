import { db } from "@/lib/db";
import { SOFTWARE, parsePlanDocument, type PlanDocument, type PlanBindings, type PlanView } from "./future-plans";

export async function planBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text(); if (text.length > 256000) throw Error("Keep each plan below 256 KB.");
  const body = JSON.parse(text); if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("Invalid plan request."); return body;
}
export function planTitle(value: unknown) { if (typeof value !== "string" || !value.trim() || value.length > 120) throw Error("Give your plan a title under 121 characters."); return value.trim(); }
export function planDescription(value: unknown) { if (typeof value !== "string" || value.length > 1000) throw Error("Keep the plan description under 1,001 characters."); return value.trim(); }
export async function verifyPlanWorkflows(userId: string, document: PlanDocument) {
  const ids = [...new Set(document.nodes.flatMap(n => n.workflowId ? [n.workflowId] : []))];
  if (!ids.length) return true;
  const count = await db.workflow.count({ where: { userId, id: { in: ids } } }); return count === ids.length;
}
export async function getPlanBindings(userId: string): Promise<PlanBindings> {
  const [user, notion, shopify, stripe, google, meta, workflows] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { tier: true, discordId: true } }),
    db.notionConnection.findUnique({ where: { userId }, select: { workspaceName: true } }),
    db.shopifyConnection.findUnique({ where: { userId }, select: { shop: true } }),
    db.stripeConnection.findUnique({ where: { userId }, select: { id: true } }),
    db.googleConnection.findUnique({ where: { userId }, select: { gaPropertyName: true } }),
    db.metaConnection.findUnique({ where: { userId }, select: { accountName: true } }),
    db.workflow.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, name: true, description: true, nodes: true, updatedAt: true, runs: { take: 1, orderBy: { startedAt: "desc" }, select: { status: true } } } }),
  ]);
  const linked = { notion: !!notion, shopify: !!shopify, stripe: !!stripe, google: !!google, meta: !!meta, discord: !!user?.discordId };
  const details: Partial<Record<string, string>> = { notion: notion?.workspaceName ?? "", shopify: shopify?.shop ?? "", google: google?.gaPropertyName ?? "", meta: meta?.accountName ?? "", discord: user?.discordId ? "Discord account linked" : "" };
  return { canRun: !!user && ["ELITE", "APEX"].includes(user.tier), software: SOFTWARE.map(s => ({ ...s, connected: linked[s.id], detail: details[s.id] })), workflows: workflows.map(w => {
    const graph = w.nodes as { nodes?: { type?: string; label?: string }[] };
    const nodes = Array.isArray(w.nodes) ? w.nodes as { type?: string; label?: string }[] : Array.isArray(graph?.nodes) ? graph.nodes : [];
    return { id: w.id, name: w.name, description: w.description, updatedAt: w.updatedAt.toISOString(), actions: nodes.filter(n => n.type?.startsWith("action_")).map(n => (n.label || n.type!.replace("action_", "").replaceAll("_", " ")).slice(0, 100)), lastStatus: w.runs[0]?.status ?? null };
  }) };
}
export async function getPlanView(userId: string, id: string): Promise<PlanView | null> {
  const plan = await db.futurePlan.findFirst({ where: { id, userId }, include: { runs: { orderBy: { createdAt: "desc" } } } });
  if (!plan) return null;
  return { ...plan, document: parsePlanDocument(plan.document), updatedAt: plan.updatedAt.toISOString(), runs: plan.runs.map(run => ({ ...run, updatedAt: run.updatedAt.toISOString() })) };
}
