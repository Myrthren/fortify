import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCampaignInsights, getAccountSummary } from "@/lib/meta";

/**
 * GET /api/meta/ads?datePreset=last_30d
 * Returns real campaign performance data from the connected Meta ad account.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const conn = await db.metaConnection.findUnique({ where: { userId } });
  if (!conn) {
    return NextResponse.json({ error: "No Meta account connected.", notConnected: true }, { status: 404 });
  }
  if (!conn.accountId) {
    return NextResponse.json({ error: "No ad account found on connected Meta account." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const datePreset = (searchParams.get("datePreset") ?? "last_30d") as string;

  try {
    const [campaigns, summary] = await Promise.all([
      getCampaignInsights(conn.accountId, conn.accessToken, datePreset),
      getAccountSummary(conn.accountId, conn.accessToken, datePreset),
    ]);

    return NextResponse.json({
      accountName: conn.accountName,
      accountId: conn.accountId,
      datePreset,
      summary,
      campaigns,
    });
  } catch (e: any) {
    console.error("[meta/ads]", e);
    // Token may have expired
    if (e.message?.includes("OAuthException") || e.message?.includes("token")) {
      return NextResponse.json(
        { error: "Meta access token expired. Reconnect your account.", tokenExpired: true },
        { status: 401 }
      );
    }
    return new NextResponse(`Failed: ${e.message}`, { status: 500 });
  }
}
