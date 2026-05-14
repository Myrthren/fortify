import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  exchangeTikTokCode,
  exchangeYouTubeCode,
  exchangeFacebookCode,
} from "@/lib/social-platforms";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code || !platform) {
    return NextResponse.redirect(new URL("/dashboard/virality?social=error", req.url));
  }

  try {
    if (platform === "tiktok") {
      const { accessToken, refreshToken, expiresAt, openId, displayName } =
        await exchangeTikTokCode(code);
      await db.socialConnection.upsert({
        where: { userId_platform: { userId, platform } },
        create: { userId, platform, accessToken, refreshToken, expiresAt, channelId: openId, channelName: displayName },
        update: { accessToken, refreshToken, expiresAt, channelId: openId, channelName: displayName },
      });
    } else if (platform === "youtube") {
      const { accessToken, refreshToken, expiresAt, channelId, channelName } =
        await exchangeYouTubeCode(code);
      await db.socialConnection.upsert({
        where: { userId_platform: { userId, platform } },
        create: { userId, platform, accessToken, refreshToken, expiresAt, channelId, channelName },
        update: { accessToken, refreshToken, expiresAt, channelId, channelName },
      });
    } else if (platform === "facebook") {
      const { accessToken, pageId, pageName } = await exchangeFacebookCode(code);
      await db.socialConnection.upsert({
        where: { userId_platform: { userId, platform } },
        create: { userId, platform, accessToken, pageId, channelName: pageName },
        update: { accessToken, pageId, channelName: pageName },
      });
    }
  } catch (e) {
    console.error(`[social/callback/${platform}]`, e);
    return NextResponse.redirect(new URL("/dashboard/virality?social=error", req.url));
  }

  return NextResponse.redirect(new URL("/dashboard/virality?social=connected", req.url));
}
