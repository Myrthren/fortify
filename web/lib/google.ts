// Google OAuth + API helpers
// GA4 (Analytics Data API v1beta), Search Console (Webmaster API v3), YouTube Analytics v2

import { db } from "@/lib/db";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA_ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";
const GA_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";
const SC_BASE = "https://www.googleapis.com/webmasters/v3";
const YT_BASE = "https://youtubeanalytics.googleapis.com/v2";

// Sensitive scopes — covered by standard Google app verification
const SCOPES_BASE = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");

// Restricted scope — requires CASA Tier 2 security assessment.
// Requested separately so GA4 / Search Console work without it.
const SCOPES_YOUTUBE = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

function cfg() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? "https://fortify-io.com/api/google/callback";
  if (!clientId || !clientSecret)
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set");
  return { clientId, clientSecret, redirectUri };
}

// ── OAuth ──────────────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string, includeYouTube = false): string {
  const { clientId, redirectUri } = cfg();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: includeYouTube ? SCOPES_YOUTUBE : SCOPES_BASE,
    access_type: "offline",
    prompt: "consent", // always force consent to get refresh_token
    state,
  });
  return `https://accounts.google.com/o/oauth2/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const { clientId, clientSecret, redirectUri } = cfg();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(`Google: ${json.error_description ?? json.error}`);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const { clientId, clientSecret } = cfg();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(`Google: ${json.error_description ?? json.error}`);
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
  };
}

/**
 * Fetches a valid (non-expired) access token for a user,
 * auto-refreshing and persisting if the current one is expired.
 */
export async function getValidGoogleToken(userId: string): Promise<{
  token: string;
  conn: NonNullable<Awaited<ReturnType<typeof db.googleConnection.findUnique>>>;
}> {
  const conn = await db.googleConnection.findUnique({ where: { userId } });
  if (!conn) throw new Error("NOT_CONNECTED");

  if (conn.tokenExpiresAt > new Date()) {
    return { token: conn.accessToken, conn };
  }

  // Token expired — refresh
  const refreshed = await refreshAccessToken(conn.refreshToken);
  const updated = await db.googleConnection.update({
    where: { id: conn.id },
    data: {
      accessToken: refreshed.accessToken,
      tokenExpiresAt: refreshed.expiresAt,
    },
  });
  return { token: refreshed.accessToken, conn: updated };
}

// ── GA4 Properties ────────────────────────────────────────────────────────────

export type GAProperty = {
  name: string;        // "properties/123456789"
  displayName: string;
};

export async function listGAProperties(token: string): Promise<GAProperty[]> {
  const res = await fetch(`${GA_ADMIN_BASE}/accountSummaries`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GA listProperties: ${await res.text()}`);
  const json = await res.json();
  const props: GAProperty[] = [];
  for (const acct of json.accountSummaries ?? []) {
    for (const p of acct.propertySummaries ?? []) {
      props.push({ name: p.property, displayName: p.displayName });
    }
  }
  return props;
}

// ── Search Console Sites ──────────────────────────────────────────────────────

export async function listSearchConsoleSites(token: string): Promise<string[]> {
  const res = await fetch(`${SC_BASE}/sites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`SC listSites: ${await res.text()}`);
  const json = await res.json();
  return (json.siteEntry ?? []).map((s: { siteUrl: string }) => s.siteUrl);
}

// ── GA4 Report ────────────────────────────────────────────────────────────────

export type GA4Data = {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
  topPages: { page: string; sessions: number }[];
  topCountries: { country: string; users: number }[];
};

export async function getGA4Report(
  propertyId: string,
  token: string,
  days = 30
): Promise<GA4Data> {
  const dateRange = { startDate: `${days}daysAgo`, endDate: "today" };

  const [summaryRes, pagesRes, countriesRes] = await Promise.all([
    fetch(`${GA_DATA_BASE}/${propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [dateRange],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
      }),
    }),
    fetch(`${GA_DATA_BASE}/${propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [dateRange],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
    }),
    fetch(`${GA_DATA_BASE}/${propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [dateRange],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 8,
      }),
    }),
  ]);

  if (!summaryRes.ok) throw new Error(`GA4 summary: ${await summaryRes.text()}`);
  if (!pagesRes.ok) throw new Error(`GA4 pages: ${await pagesRes.text()}`);
  if (!countriesRes.ok) throw new Error(`GA4 countries: ${await countriesRes.text()}`);

  const [summaryJson, pagesJson, countriesJson] = await Promise.all([
    summaryRes.json(),
    pagesRes.json(),
    countriesRes.json(),
  ]);

  const row = summaryJson.rows?.[0]?.metricValues ?? [];

  return {
    sessions: Number(row[0]?.value ?? 0),
    users: Number(row[1]?.value ?? 0),
    pageviews: Number(row[2]?.value ?? 0),
    bounceRate: Math.round(Number(row[3]?.value ?? 0) * 100),
    avgSessionDuration: Math.round(Number(row[4]?.value ?? 0)),
    topPages: (pagesJson.rows ?? []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      page: r.dimensionValues[0].value,
      sessions: Number(r.metricValues[0].value),
    })),
    topCountries: (countriesJson.rows ?? []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      country: r.dimensionValues[0].value,
      users: Number(r.metricValues[0].value),
    })),
  };
}

// ── Search Console ────────────────────────────────────────────────────────────

export type SCData = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
  topPages: { page: string; clicks: number; impressions: number }[];
};

export async function getSearchConsoleData(
  siteUrl: string,
  token: string,
  days = 30
): Promise<SCData> {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

  async function scQuery(dimensions: string[]) {
    const res = await fetch(
      `${SC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: 10 }),
      }
    );
    if (!res.ok) throw new Error(`SC query: ${await res.text()}`);
    return res.json();
  }

  const [summaryJson, queriesJson, pagesJson] = await Promise.all([
    scQuery([]),
    scQuery(["query"]),
    scQuery(["page"]),
  ]);

  const totals = summaryJson.rows?.[0] ?? {};

  return {
    clicks: totals.clicks ?? 0,
    impressions: totals.impressions ?? 0,
    ctr: Math.round((totals.ctr ?? 0) * 1000) / 10, // 1 decimal %
    position: Math.round((totals.position ?? 0) * 10) / 10,
    topQueries: (queriesJson.rows ?? []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Math.round(r.ctr * 1000) / 10,
      position: Math.round(r.position * 10) / 10,
    })),
    topPages: (pagesJson.rows ?? []).map((r: { keys: string[]; clicks: number; impressions: number }) => ({
      page: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
    })),
  };
}

// ── YouTube Analytics ─────────────────────────────────────────────────────────

export type YTData = {
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  subscribersGained: number;
  subscribersLost: number;
};

export async function getYouTubeAnalytics(
  token: string,
  days = 30
): Promise<YTData> {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics:
      "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost",
  });
  const res = await fetch(`${YT_BASE}/reports?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`YouTube Analytics: ${await res.text()}`);
  const json = await res.json();
  const row = json.rows?.[0] ?? [0, 0, 0, 0, 0];
  return {
    views: row[0] ?? 0,
    estimatedMinutesWatched: row[1] ?? 0,
    averageViewDuration: Math.round(row[2] ?? 0),
    subscribersGained: row[3] ?? 0,
    subscribersLost: row[4] ?? 0,
  };
}
