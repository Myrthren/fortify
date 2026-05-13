// Meta Marketing API + OAuth helpers
// Graph API v19.0

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

function cfg() {
  const appId = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI ?? "https://fortify-io.com/api/meta/callback";
  if (!appId || !secret) throw new Error("META_APP_ID / META_APP_SECRET not set");
  return { appId, secret, redirectUri };
}

// ── OAuth ──────────────────────────────────────────────────────────────────────

/** Build the Facebook OAuth dialog URL. state = userId (CSRF guard). */
export function buildAuthUrl(state: string): string {
  const { appId, redirectUri } = cfg();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: "ads_read,business_basic",
    state,
    response_type: "code",
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
}

/** Exchange auth code for a short-lived user access token. */
export async function exchangeCode(code: string): Promise<string> {
  const { appId, secret, redirectUri } = cfg();
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: secret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Meta token exchange failed: ${txt}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Meta: ${json.error.message}`);
  return json.access_token as string;
}

/** Upgrade a short-lived token to a 60-day long-lived token. */
export async function getLongLivedToken(shortToken: string): Promise<string> {
  const { appId, secret } = cfg();
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: secret,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Meta long-lived token failed: ${txt}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Meta: ${json.error.message}`);
  return json.access_token as string;
}

// ── Ad Accounts ───────────────────────────────────────────────────────────────

export type AdAccount = {
  id: string;        // "act_123456"
  name: string;
  currency: string;
  account_status: number; // 1 = active
};

export async function getAdAccounts(token: string): Promise<AdAccount[]> {
  const res = await fetch(
    `${GRAPH_BASE}/me/adaccounts?fields=id,name,account_status,currency&access_token=${token}`
  );
  if (!res.ok) throw new Error(`Meta getAdAccounts: ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(`Meta: ${json.error.message}`);
  return (json.data ?? []) as AdAccount[];
}

// ── Campaign Insights ─────────────────────────────────────────────────────────

export type CampaignInsight = {
  campaign_id: string;
  campaign_name: string;
  impressions: string;
  clicks: string;
  ctr: string;
  spend: string;
  reach: string;
  cpc: string;
  actions?: { action_type: string; value: string }[];
};

export async function getCampaignInsights(
  accountId: string,
  token: string,
  datePreset = "last_30d"
): Promise<CampaignInsight[]> {
  const fields = "campaign_name,impressions,clicks,ctr,spend,reach,cpc,actions";
  const res = await fetch(
    `${GRAPH_BASE}/${accountId}/insights?level=campaign&fields=${fields}&date_preset=${datePreset}&access_token=${token}`
  );
  if (!res.ok) throw new Error(`Meta getCampaignInsights: ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(`Meta: ${json.error.message}`);
  return (json.data ?? []) as CampaignInsight[];
}

// ── Account-level summary ─────────────────────────────────────────────────────

export type AccountSummary = {
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  ctr: string;
  cpc: string;
};

export async function getAccountSummary(
  accountId: string,
  token: string,
  datePreset = "last_30d"
): Promise<AccountSummary | null> {
  const fields = "impressions,clicks,spend,reach,ctr,cpc";
  const res = await fetch(
    `${GRAPH_BASE}/${accountId}/insights?fields=${fields}&date_preset=${datePreset}&access_token=${token}`
  );
  if (!res.ok) throw new Error(`Meta getAccountSummary: ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(`Meta: ${json.error.message}`);
  return (json.data?.[0] ?? null) as AccountSummary | null;
}
