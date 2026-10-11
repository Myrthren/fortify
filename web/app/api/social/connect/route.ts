import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildTikTokAuthUrl, buildYouTubeAuthUrl, buildFacebookAuthUrl } from "@/lib/social-platforms";
import { createOAuthState } from "@/lib/oauth-state";

// GET /api/social/connect?platform=tiktok|youtube|facebook
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  if (!platform || !["tiktok", "youtube", "facebook"].includes(platform)) {
    return NextResponse.json({ error: "platform must be tiktok, youtube, or facebook" }, { status: 400 });
  }
  const state = createOAuthState((session.user as any).id as string, `social:${platform}`);

  let authUrl: string;
  if (platform === "tiktok") {
    authUrl = buildTikTokAuthUrl(state);
  } else if (platform === "youtube") {
    authUrl = buildYouTubeAuthUrl(state);
  } else {
    authUrl = buildFacebookAuthUrl(state);
  }

  return NextResponse.redirect(authUrl);
}
