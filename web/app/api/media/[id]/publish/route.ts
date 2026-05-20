import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import {
  publishToTikTok,
  publishToYouTube,
  publishToFacebook,
  refreshTikTokToken,
  refreshYouTubeToken,
} from "@/lib/social-platforms";
import type { PublishResult } from "@/lib/social-platforms";

// POST /api/media/[id]/publish
// Body: { platforms: ["tiktok", "youtube", "facebook"] }
// Elite+: manual publish to selected platforms

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;
  const { id } = await params;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !TIER_LIMITS[user.tier].virality) {
    return NextResponse.json({ error: "Virality Engine requires Elite or Apex." }, { status: 403 });
  }

  const item = await db.mediaItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const platforms: string[] = body.platforms ?? item.targetPlatforms;

  // Load social connections
  const connections = await db.socialConnection.findMany({
    where: { userId, platform: { in: platforms } },
  });

  await db.mediaItem.update({ where: { id }, data: { publishStatus: "PUBLISHING" } });

  const results: Record<string, PublishResult> = {};
  const report = item.viralityReport as any;

  for (const platform of platforms) {
    // TikTok posting is not yet available — Content Posting API approval pending
    if (platform === "tiktok") {
      results[platform] = { success: false, error: "TikTok publishing is coming soon." };
      continue;
    }

    const conn = connections.find((c) => c.platform === platform);
    if (!conn) {
      results[platform] = { success: false, error: `${platform} not connected` };
      continue;
    }

    // Refresh token if needed
    let token = conn.accessToken;
    if (conn.expiresAt && conn.expiresAt < new Date()) {
      try {
        if (platform === "tiktok" && conn.refreshToken) {
          const r = await refreshTikTokToken(conn.refreshToken);
          await db.socialConnection.update({
            where: { id: conn.id },
            data: { accessToken: r.accessToken, refreshToken: r.refreshToken, expiresAt: r.expiresAt },
          });
          token = r.accessToken;
        } else if (platform === "youtube" && conn.refreshToken) {
          const r = await refreshYouTubeToken(conn.refreshToken);
          await db.socialConnection.update({
            where: { id: conn.id },
            data: { accessToken: r.accessToken, expiresAt: r.expiresAt },
          });
          token = r.accessToken;
        }
      } catch (e: any) {
        results[platform] = { success: false, error: `Token refresh failed: ${e.message}` };
        continue;
      }
    }

    const tags: string[] = report?.platforms?.[platform]?.tags ?? [];
    const description = item.description ?? "";

    try {
      if (platform === "tiktok") {
        results[platform] = await publishToTikTok(token, item.videoUrl, item.title, tags);
      } else if (platform === "youtube") {
        results[platform] = await publishToYouTube(token, item.videoUrl, item.title, description, tags);
      } else if (platform === "facebook" && conn.pageId) {
        results[platform] = await publishToFacebook(token, conn.pageId, item.videoUrl, item.title, description, tags);
      }
    } catch (e: any) {
      results[platform] = { success: false, error: e.message };
    }
  }

  const allSuccess = Object.values(results).every((r) => r.success);
  const anySuccess = Object.values(results).some((r) => r.success);

  await db.mediaItem.update({
    where: { id },
    data: {
      publishStatus: allSuccess ? "PUBLISHED" : anySuccess ? "PUBLISHED" : "FAILED",
      publishedAt: anySuccess ? new Date() : undefined,
      publishResults: results as any,
    },
  });

  return NextResponse.json({ ok: true, results });
}
