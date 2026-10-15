import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  if (process.env.FORTIFY_ENV !== "staging") return new NextResponse(null, { status: 404 });
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", environment: "staging", revision: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) ?? "unknown" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
