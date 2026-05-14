import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  publishToTikTok, publishToYouTube, publishToFacebook,
  refreshTikTokToken, refreshYouTubeToken,
} from "@/lib/social-platforms";
import type { PublishResult } from "@/lib/social-platforms";

/**
 * POST /api/cron/auto-publish
 * Run every 15 minutes. Finds SCHEDULED MediaItems whose scheduledAt has passed
 * and publishes them via platform APIs. Apex users only.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();

  const dueItems = await db.mediaItem.findMany({
    where: {
      publishStatus: "SCHEDULED",
      scheduledAt: { lte: now },
      user: { tier: "APEX" },
    },
    include: {
      user: {
        select: {
          id: true,
          discordId: true,
          socialConnections: true,
        },
      },
    },
  });

  let published = 0;
  let failed = 0;

  for (const item of dueItems) {
    // Mark as PUBLISHING immediately to prevent double-runs
    await db.mediaItem.update({ where: { id: item.id }, data: { publishStatus: "PUBLISHING" } });

    const results: Record<string, PublishResult> = {};
    const report = item.viralityReport as any;

    for (const platform of item.targetPlatforms) {
      const conn = item.user.socialConnections.find((c) => c.platform === platform);
      if (!conn) {
        results[platform] = { success: false, error: `${platform} not connected` };
        continue;
      }

      let token = conn.accessToken;

      // Refresh stale tokens
      if (conn.expiresAt && conn.expiresAt < now) {
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

    const anySuccess = Object.values(results).some((r) => r.success);

    await db.mediaItem.update({
      where: { id: item.id },
      data: {
        publishStatus: anySuccess ? "PUBLISHED" : "FAILED",
        publishedAt: anySuccess ? now : undefined,
        publishResults: results as any,
      },
    });

    if (anySuccess) published++;
    else failed++;
  }

  return NextResponse.json({ ok: true, processed: dueItems.length, published, failed });
}
