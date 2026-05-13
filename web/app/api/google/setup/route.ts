import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/google/setup
 * Saves the user's selected GA4 property and/or Search Console site.
 * Body: { gaPropertyId?, gaPropertyName?, scSiteUrl? }
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => ({}));
  const { gaPropertyId, gaPropertyName, scSiteUrl } = body as Record<string, string>;

  const conn = await db.googleConnection.findUnique({ where: { userId } });
  if (!conn) return NextResponse.json({ error: "Not connected" }, { status: 404 });

  const updated = await db.googleConnection.update({
    where: { userId },
    data: {
      ...(gaPropertyId !== undefined && { gaPropertyId: gaPropertyId || null }),
      ...(gaPropertyName !== undefined && { gaPropertyName: gaPropertyName || null }),
      ...(scSiteUrl !== undefined && { scSiteUrl: scSiteUrl || null }),
    },
  });

  return NextResponse.json({
    gaPropertyId: updated.gaPropertyId,
    gaPropertyName: updated.gaPropertyName,
    scSiteUrl: updated.scSiteUrl,
  });
}
