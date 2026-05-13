import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getValidGoogleToken, listGAProperties, listSearchConsoleSites } from "@/lib/google";

/**
 * GET /api/google/properties
 * Returns the user's GA4 properties and Search Console sites for the setup UI.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  try {
    const { token } = await getValidGoogleToken(userId);
    const [gaProperties, scSites] = await Promise.allSettled([
      listGAProperties(token),
      listSearchConsoleSites(token),
    ]);

    return NextResponse.json({
      gaProperties: gaProperties.status === "fulfilled" ? gaProperties.value : [],
      scSites: scSites.status === "fulfilled" ? scSites.value : [],
    });
  } catch (e: any) {
    if (e.message === "NOT_CONNECTED") {
      return NextResponse.json({ error: "Not connected" }, { status: 404 });
    }
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
