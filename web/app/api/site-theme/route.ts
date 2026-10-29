import { NextResponse } from "next/server";
import { readSiteAppearance } from "@/lib/site-appearance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readSiteAppearance(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Existing tabs retain their current appearance if settings are unavailable.
    return NextResponse.json({ error: "Appearance settings unavailable" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
