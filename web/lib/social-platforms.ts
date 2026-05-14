// Social platform OAuth + video publish helpers
// TikTok: requires Content Posting API approval at developers.tiktok.com
// YouTube: uses Google OAuth (youtube.upload scope)
// Facebook: requires a Facebook Page

const TIKTOK_BASE  = "https://open.tiktokapis.com/v2";
const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3";
const FB_BASE      = "https://graph-video.facebook.com/v19.0";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PublishResult = {
  success: boolean;
  url?: string;
  platformPostId?: string;
  error?: string;
};

// ── TikTok OAuth ──────────────────────────────────────────────────────────────

export function buildTikTokAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    scope: "user.info.basic,video.publish,video.upload",
    response_type: "code",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback?platform=tiktok`,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
}

export async function exchangeTikTokCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  openId: string;
  displayName: string;
}> {
  const res = await fetch(`${TIKTOK_BASE}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback?platform=tiktok`,
    }),
  });
  if (!res.ok) throw new Error(`TikTok token exchange failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);

  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresAt: new Date(Date.now() + data.data.expires_in * 1000),
    openId: data.data.open_id,
    displayName: data.data.display_name ?? data.data.open_id,
  };
}

// ── YouTube OAuth (Google, youtube.upload scope) ──────────────────────────────

export function buildYouTubeAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback?platform=youtube`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeYouTubeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  channelId: string;
  channelName: string;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback?platform=youtube`,
    }),
  });
  if (!res.ok) throw new Error(`YouTube token exchange failed: ${res.status}`);
  const tokens = await res.json();

  // Fetch channel info
  const chRes = await fetch(
    `${YOUTUBE_BASE}/channels?part=snippet&mine=true`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const chData = await chRes.json();
  const channel = chData.items?.[0];

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    channelId: channel?.id ?? "",
    channelName: channel?.snippet?.title ?? "My Channel",
  };
}

// ── Facebook OAuth ────────────────────────────────────────────────────────────

export function buildFacebookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback?platform=facebook`,
    scope: "pages_manage_posts,pages_read_engagement,pages_show_list",
    state,
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeFacebookCode(code: string): Promise<{
  accessToken: string;
  pageId: string;
  pageName: string;
}> {
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback?platform=facebook`,
        code,
      })
  );
  if (!tokenRes.ok) throw new Error(`Facebook token exchange failed: ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  const userToken = tokenData.access_token;

  // Get Pages the user manages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`
  );
  const pagesData = await pagesRes.json();
  const page = pagesData.data?.[0];
  if (!page) throw new Error("No Facebook Pages found. You must have at least one managed Page.");

  return {
    accessToken: page.access_token, // Page token (long-lived)
    pageId: page.id,
    pageName: page.name,
  };
}

// ── Refresh tokens ────────────────────────────────────────────────────────────

export async function refreshTikTokToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const res = await fetch(`${TIKTOK_BASE}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`TikTok refresh failed: ${res.status}`);
  const data = await res.json();
  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresAt: new Date(Date.now() + data.data.expires_in * 1000),
  };
}

export async function refreshYouTubeToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`YouTube refresh failed: ${res.status}`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// ── Publish video ─────────────────────────────────────────────────────────────

export async function publishToTikTok(
  accessToken: string,
  videoUrl: string,
  title: string,
  tags: string[]
): Promise<PublishResult> {
  try {
    // Step 1: Init upload
    const initRes = await fetch(`${TIKTOK_BASE}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: `${title} ${tags.map((t) => `#${t}`).join(" ")}`.slice(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    });
    const initData = await initRes.json();
    if (!initRes.ok || initData.error?.code !== "ok") {
      return { success: false, error: initData.error?.message ?? "TikTok init failed" };
    }
    const publishId = initData.data?.publish_id;
    return { success: true, platformPostId: publishId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function publishToYouTube(
  accessToken: string,
  videoUrl: string,
  title: string,
  description: string,
  tags: string[]
): Promise<PublishResult> {
  try {
    // YouTube requires multipart upload. With a public URL we use resumable upload with a URI.
    const insertRes = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/*",
        },
        body: JSON.stringify({
          snippet: {
            title: title.slice(0, 100),
            description: `${description}\n\n${tags.map((t) => `#${t}`).join(" ")}`.slice(0, 5000),
            tags: tags.slice(0, 30),
          },
          status: { privacyStatus: "public" },
        }),
      }
    );

    if (!insertRes.ok) {
      const err = await insertRes.json().catch(() => ({}));
      return { success: false, error: (err as any).error?.message ?? `YouTube insert failed: ${insertRes.status}` };
    }

    const uploadUri = insertRes.headers.get("Location");
    if (!uploadUri) return { success: false, error: "No upload URI from YouTube" };

    // Fetch the video from URL and re-upload to YouTube
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) return { success: false, error: "Could not fetch video from provided URL" };
    const videoBlob = await videoRes.arrayBuffer();

    const uploadRes = await fetch(uploadUri, {
      method: "PUT",
      headers: {
        "Content-Type": "video/*",
        "Content-Length": String(videoBlob.byteLength),
      },
      body: videoBlob,
    });

    if (!uploadRes.ok) {
      return { success: false, error: `YouTube upload failed: ${uploadRes.status}` };
    }

    const uploadData = await uploadRes.json();
    return {
      success: true,
      platformPostId: uploadData.id,
      url: `https://youtu.be/${uploadData.id}`,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function publishToFacebook(
  accessToken: string,
  pageId: string,
  videoUrl: string,
  title: string,
  description: string,
  tags: string[]
): Promise<PublishResult> {
  try {
    const res = await fetch(`${FB_BASE}/${pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: videoUrl,
        title: title.slice(0, 100),
        description: `${description}\n\n${tags.map((t) => `#${t}`).join(" ")}`.slice(0, 63206),
        access_token: accessToken,
        published: true,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message ?? `Facebook post failed: ${res.status}` };
    }

    return {
      success: true,
      platformPostId: data.id,
      url: data.permalink_url ?? `https://facebook.com/${data.id}`,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
