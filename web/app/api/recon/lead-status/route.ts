import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isPipelineStage, leadUrl } from "@/lib/pipeline";
import { mutationOrigin, workspaceUserId } from "@/lib/workspace-request";


// GET — all lead statuses for the current user, keyed by URL
export async function GET() {
  const userId = await workspaceUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const statuses = await db.leadStatus.findMany({
    where: { userId },
    select: { url: true, status: true },
  });

  return NextResponse.json({ statuses });
}

// PATCH — upsert the status for a single lead (keyed by business URL)
export async function PATCH(req: Request) {
  const userId = await workspaceUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  if (!mutationOrigin(req)) return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json().catch(() => ({}));
  const url: string = typeof body?.url === "string" ? body.url.trim() : "";
  const status: string = body?.status;

  if (!url || url.length > 2048) return NextResponse.json({ error: "A valid business URL is required" }, { status: 400 });
  if (!isPipelineStage(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  let canonical: string;
  try { canonical = leadUrl(url); } catch { return NextResponse.json({ error: "A valid business URL is required" }, { status: 400 }); }
  const existing = await db.leadStatus.findFirst({ where: { userId, url: { in: [url, canonical, canonical.replace(/\/$/, "")] } }, select: { id: true } });
  if (existing) await db.leadStatus.update({ where: { id: existing.id, userId }, data: { status } });
  else await db.leadStatus.upsert({
    where: { userId_url: { userId, url: canonical } },
    update: { status },
    create: { userId, url: canonical, status },
  });

  return NextResponse.json({ ok: true });
}
