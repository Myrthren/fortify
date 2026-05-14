import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { exportCompetitorReport, exportContentIdeas, exportViralityReport } from "@/lib/notion";

// POST /api/notion/export
// Body: { type: "competitor" | "content" | "virality", data: {...} }

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const conn = await db.notionConnection.findUnique({ where: { userId } });
  if (!conn) return NextResponse.json({ error: "Notion not connected" }, { status: 404 });
  if (!conn.rootPageId) return NextResponse.json({ error: "Select a Notion page first in Settings" }, { status: 400 });

  const body = await req.json();
  const { type, data } = body;

  try {
    let result;
    if (type === "competitor") {
      result = await exportCompetitorReport(conn.accessToken, conn.rootPageId, data);
    } else if (type === "content") {
      result = await exportContentIdeas(conn.accessToken, conn.rootPageId, data.niche, data.ideas);
    } else if (type === "virality") {
      result = await exportViralityReport(conn.accessToken, conn.rootPageId, data);
    } else {
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, pageId: (result as any).id });
  } catch (e: any) {
    console.error("[notion/export]", e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
