import type { Prisma } from "@prisma/client";
import { CLOSED_STAGES, isPipelineStage } from "./pipeline";
export function pipelineWhere(userId: string, params: { q?: string | null; stage?: string | null; view?: string | null; cursor?: string | null }): Prisma.LeadStatusWhereInput {
  const { q, stage, view, cursor } = params;
  if ((q?.length ?? 0) > 160 || (cursor?.length ?? 0) > 200 || (stage && stage !== "all" && !isPipelineStage(stage)) || (view && !["all", "due", "open"].includes(view))) throw new Error("Invalid pipeline filters.");
  const where: Prisma.LeadStatusWhereInput = { userId };
  if (cursor) where.id = { lt: cursor };
  if (stage && stage !== "all") where.status = stage;
  const conditions: Prisma.LeadStatusWhereInput[] = [];
  if (view === "open" || view === "due") conditions.push({ status: { notIn: CLOSED_STAGES } });
  if (view === "due") { const end = new Date(); end.setUTCHours(23, 59, 59, 999); conditions.push({ followUpAt: { lte: end } }); }
  if (q?.trim()) conditions.push({ OR: ["company", "url", "context", "notes", "email"].map(field => ({ [field]: { contains: q.trim(), mode: "insensitive" } })) });
  if (conditions.length) where.AND = conditions;
  return where;
}
