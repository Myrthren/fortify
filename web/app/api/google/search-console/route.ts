import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getValidGoogleToken, getSearchConsoleData } from "@/lib/google";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") ?? 30), 90);

  try {
    const { token, conn } = await getValidGoogleToken(userId);

    if (!conn.scSiteUrl) {
      return NextResponse.json({ error: "No Search Console site selected. Set it up in Settings." }, { status: 428 });
    }

    const data = await getSearchConsoleData(conn.scSiteUrl, token, days);
    return NextResponse.json({ ...data, siteUrl: conn.scSiteUrl });
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") {
      return NextResponse.json({ error: "Google not connected", notConnected: true }, { status: 404 });
    }
    console.error("[google/search-console]", e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
