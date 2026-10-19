import { NextResponse } from "next/server";
import { leadPackTick } from "@/lib/lead-pack";

/**
 * POST /api/cron/lead-packs
 * Every 15 minutes. Collects finished Google Maps scrapes into lead packs and
 * starts scrapes for packs that are due. Stops taking new work after ~40s so
 * the request stays inside Netlify's 60-second limit.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await leadPackTick(Date.now() + 40_000);
  return NextResponse.json({ ok: true, ...result });
}
