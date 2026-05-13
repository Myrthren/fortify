import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getValidGoogleToken, getYouTubeAnalytics } from "@/lib/google";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") ?? 30), 365);

  try {
    const { token } = await getValidGoogleToken(userId);
    const data = await getYouTubeAnalytics(token, days);
    return NextResponse.json(data);
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") {
      return NextResponse.json({ error: "Google not connected", notConnected: true }, { status: 404 });
    }
    // YouTube Analytics 403 = no channel or no data — handle gracefully
    if (e.message?.includes("403") || e.message?.includes("404")) {
      return NextResponse.json({ error: "No YouTube channel linked to this Google account.", noChannel: true }, { status: 404 });
    }
    console.error("[google/youtube]", e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
