import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseLeadInput } from "@/lib/pipeline";
import { workspaceUserId, mutationOrigin, workspaceError, workspaceBody } from "@/lib/workspace-request";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { pipelineWhere } from "@/lib/pipeline-query";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to see your pipeline.", 401);
  let where;
  try { where = pipelineWhere(userId, Object.fromEntries(new URL(req.url).searchParams)); } catch { return workspaceError("Invalid pipeline filters."); }
  try {
    const [rows, stages] = await Promise.all([db.leadStatus.findMany({ where, orderBy: { id: "desc" }, take: 101 }), db.leadStatus.groupBy({ by: ["status"], where: { userId }, _count: true })]);
    return NextResponse.json({ leads: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99].id : null, counts: Object.fromEntries(stages.map(item => [item.status, item._count])) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return workspaceError("Your pipeline could not be loaded. Please try again.", 503); }
}

export async function POST(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return workspaceError("Sign in to save leads.", 401);
  if (!mutationOrigin(req)) return workspaceError("Request origin was rejected.", 403);
  const limit = rateLimit(`pipeline:${userId}`, 40, 60000);
  if (!limit.ok) return rateLimitResponse(limit.resetMs);
  let input;
  let originalUrl = "";
  try { const body = await workspaceBody(req); originalUrl = typeof body.url === "string" ? body.url.trim() : ""; input = parseLeadInput(body); } catch (error) { return workspaceError(error instanceof SyntaxError ? "Invalid request." : (error as Error).message); }
  // Preserve older Recon status keys when the original URL lacked a trailing slash.
  const alternatives = [...new Set([input.url, input.url.replace(/\/$/, ""), originalUrl])];
  try {
    const existing = await db.leadStatus.findFirst({ where: { userId, url: { in: alternatives } }, select: { id: true } });
    const metadata = { company: input.company, context: input.context || undefined, email: input.email || undefined };
    const lead = existing
      ? await db.leadStatus.update({ where: { id: existing.id, userId }, data: metadata })
      : await db.leadStatus.upsert({ where: { userId_url: { userId, url: input.url } }, update: metadata,
        create: { userId, ...input, status: input.draft ? "draft-ready" : "new" } });
    return NextResponse.json({ lead });
  } catch { return workspaceError("This lead could not be saved. Please try again.", 503); }
}
