import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAuthUrl } from "@/lib/google";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", process.env.AUTH_URL ?? "https://fortify-io.com"));
  const userId = (session.user as any).id as string;
  // Pass ?youtube=1 to request yt-analytics.readonly (restricted scope — needs CASA approval)
  const includeYouTube = new URL(req.url).searchParams.get("youtube") === "1";
  return NextResponse.redirect(buildAuthUrl(userId, includeYouTube));
}
