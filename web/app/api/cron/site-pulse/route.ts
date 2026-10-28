import { NextResponse } from "next/server";
import { sitePulseTick } from "@/lib/site-pulse";

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) return new NextResponse("Unauthorized", { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await sitePulseTick()) });
  } catch (error) {
    console.error("[cron] site-pulse failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Website Pulse will retry on its next scheduled run." }, { status: 500 });
  }
}
