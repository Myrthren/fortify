import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { exchangeCode } from "@/lib/google";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", process.env.AUTH_URL ?? "https://fortify-io.com"));
  }
  const userId = (session.user as any).id as string;
  const base = process.env.AUTH_URL ?? "https://fortify-io.com";

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${base}/dashboard/analytics?error=${encodeURIComponent(error)}`);
  }

  if (!code || state !== userId) {
    return NextResponse.redirect(`${base}/dashboard/analytics?error=invalid_state`);
  }

  try {
    const { accessToken, refreshToken, expiresAt } = await exchangeCode(code);

    await db.googleConnection.upsert({
      where: { userId },
      create: {
        userId,
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
      },
      update: {
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        // Reset property selections on reconnect
        gaPropertyId: null,
        gaPropertyName: null,
        scSiteUrl: null,
        ytChannelId: null,
        ytChannelName: null,
      },
    });

    return NextResponse.redirect(`${base}/dashboard/analytics?google=connected`);
  } catch (e: any) {
    console.error("[google/callback]", e);
    return NextResponse.redirect(
      `${base}/dashboard/analytics?error=${encodeURIComponent(e.message ?? "OAuth failed")}`
    );
  }
}
