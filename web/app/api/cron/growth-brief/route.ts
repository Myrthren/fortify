import { NextResponse } from "next/server";
import { growthBriefTick } from "@/lib/growth-brief";

/**
 * POST /api/cron/growth-brief
 * Hourly. Writes this month's Growth Brief for one Apex member who doesn't
 * have one yet (one per run keeps the request inside the 60-second limit).
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const result = await growthBriefTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[cron] growth-brief failed:", err?.message ?? err);
    return NextResponse.json({ ok: false, error: "Brief generation failed; it will retry next hour." }, { status: 500 });
  }
}
