import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildTikTokAuthUrl, buildYouTubeAuthUrl, buildFacebookAuthUrl } from "@/lib/social-platforms";

// GET /api/social/connect?platform=tiktok|youtube|facebook
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const state = Math.random().toString(36).slice(2);

  let authUrl: string;
  if (platform === "tiktok") {
    authUrl = buildTikTokAuthUrl(state);
  } else if (platform === "youtube") {
    authUrl = buildYouTubeAuthUrl(state);
  } else if (platform === "facebook") {
    authUrl = buildFacebookAuthUrl(state);
  } else {
    return NextResponse.json({ error: "platform must be tiktok, youtube, or facebook" }, { status: 400 });
  }

  return NextResponse.redirect(authUrl);
}
