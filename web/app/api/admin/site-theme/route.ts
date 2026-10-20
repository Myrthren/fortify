import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { isSiteTheme } from "@/lib/site-theme";
import { saveSiteTheme } from "@/lib/site-appearance";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: (session.user as { id: string }).id },
    select: { id: true, discordId: true },
  });
  if (!user || !isOwner(user.discordId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("theme" in body) || !isSiteTheme(body.theme)) {
    return NextResponse.json({ error: "Choose Classic or Sci-fi" }, { status: 400 });
  }
  try {
    const theme = await saveSiteTheme(body.theme, user.id);
    return NextResponse.json({ theme }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save the site theme. Please try again." }, { status: 503 });
  }
}
