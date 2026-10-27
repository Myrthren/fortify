import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getAnnouncements } from "@/lib/announcements";
export async function GET() {
  if (!(await auth())?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ announcements: await getAnnouncements() }, { headers: { "Cache-Control": "no-store" } });
}
