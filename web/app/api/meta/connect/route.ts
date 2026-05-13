import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAuthUrl } from "@/lib/meta";

/**
 * GET /api/meta/connect
 * Redirects the authenticated user to the Facebook OAuth dialog.
 * state = userId (verified in callback to prevent CSRF).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  try {
    const url = buildAuthUrl(userId);
    return NextResponse.redirect(url);
  } catch (e: any) {
    return new NextResponse(`Meta config error: ${e.message}`, { status: 500 });
  }
}
