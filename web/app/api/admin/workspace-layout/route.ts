import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { saveWorkspaceLayout } from "@/lib/site-appearance";
import { isWorkspaceLayout } from "@/lib/workspace-layout";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: (session.user as { id: string }).id },
    select: { id: true, discordId: true },
  });
  if (!user || !isOwner(user.discordId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("workspaceLayout" in body) || !isWorkspaceLayout(body.workspaceLayout)) {
    return NextResponse.json({ error: "Choose Classic workspace or Command Centre" }, { status: 400 });
  }
  try {
    const workspaceLayout = await saveWorkspaceLayout(body.workspaceLayout, user.id);
    return NextResponse.json({ workspaceLayout }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save the workspace layout. Please try again." }, { status: 503 });
  }
}
