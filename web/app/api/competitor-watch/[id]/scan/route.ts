import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { scanWatch } from "@/lib/competitor-watch-scan";
export const maxDuration = 60;
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  try { return NextResponse.json(await scanWatch((await params).id, (session.user as any).id)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: message === "Watch not found" ? 404 : /requires Elite/.test(message) ? 403 : /credits/.test(message) ? 402 : 502 });
  }
}
