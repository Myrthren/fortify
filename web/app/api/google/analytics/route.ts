import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getValidGoogleToken, getGA4Report } from "@/lib/google";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") ?? 30), 365);

  try {
    const { token, conn } = await getValidGoogleToken(userId);

    if (!conn.gaPropertyId) {
      return NextResponse.json({ error: "No GA4 property selected. Set it up in Settings." }, { status: 428 });
    }

    const data = await getGA4Report(conn.gaPropertyId, token, days);
    return NextResponse.json({ ...data, propertyName: conn.gaPropertyName });
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") {
      return NextResponse.json({ error: "Google not connected", notConnected: true }, { status: 404 });
    }
    console.error("[google/analytics]", e);
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
