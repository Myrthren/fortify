# 🏰 Fortify — Setup Guide

Step-by-step from cloned repo → live tool.

---

## 0. Prereqs

- Node.js 20+
- A Supabase project (you have one)
- A Discord application + bot (you have one)
- PayPal live app + 3 plans (done)
- API keys: Anthropic, OpenAI, Brave, Resend

---

## 1. Install dependencies

```bash
cd web && npm install
cd ../bot && npm install
```

---

## 2. Get your `DATABASE_URL` from Supabase

1. Open your Supabase project → **Project Settings** → **Database**
2. Under **Connection string**, copy the **Transaction** pooler URL (port 6543) → put it in `DATABASE_URL`
3. Copy the **Session** pooler URL (port 5432) → put it in `DIRECT_URL`
4. Replace `[YOUR-PASSWORD]` with your DB password in both

---

## 3. Configure Discord

### A. Bot
1. https://discord.com/developers/applications → your Fortify app → **Bot**
2. Reset token, copy → `DISCORD_BOT_TOKEN` (in both `web/.env.local` and `bot/.env.local`)
3. Under **Privileged Gateway Intents**, enable **both**:
   - **Server Members Intent**
   - **Message Content Intent**

   ⚠️ Both are required. The bot requests them at startup, so if either is off
   Discord rejects the connection with a "disallowed intents" error and the bot
   never comes online.

### B. OAuth2
1. **OAuth2 → General** → copy Client Secret → `DISCORD_CLIENT_SECRET`
2. **OAuth2 → Redirects** → add: `http://localhost:3000/api/auth/callback/discord`
3. (After deploy) Add: `https://<your-netlify>.netlify.app/api/auth/callback/discord`

### C. Roles
In your Discord server, create 3 paid-tier roles: **Pro**, **Elite**, **Apex**.
(Free tier has no role — they're just regular members.)

Right-click each → Copy ID → fill into `.env.local`:
- `DISCORD_ROLE_PRO`
- `DISCORD_ROLE_ELITE`
- `DISCORD_ROLE_APEX`

**Critical:** the bot's role in the server must be **above** all three tier roles for it to assign them. Drag it up in Server Settings → Roles.

### D. Invite bot to server
Use this URL (replace CLIENT_ID):
```
https://discord.com/oauth2/authorize?client_id=1497398931930349809&permissions=268512272&scope=bot%20applications.commands
```

`268512272` covers View Channel, Send Messages, Manage Messages, Read Message
History, **Manage Channels** and **Manage Roles**. The last two are needed for the
owner-only admin tools (`bot/src/lib/admin-tools.ts`) — without them those tools
fail at the Discord API rather than in the bot.

Re-running this URL on a server the bot is already in just updates its permissions;
it does not remove or reset the bot.

---

## 4. Fill `.env.local` files

Copy `.env.example` → `.env.local` in both `web/` and `bot/`. Fill every blank.

Generate `AUTH_SECRET`:
```bash
openssl rand -base64 32
```

---

## 5. Apply the database schema

There is **no migrations directory** — the schema is applied with `db push`.

```bash
cd web
npx prisma db push
npx prisma generate
```

⚠️ The Prisma CLI only auto-loads `.env`, **not** `.env.local`. Without passing the
vars explicitly it fails with `Environment variable not found: DIRECT_URL`:

```bash
set -a && source <(grep -E "^(DATABASE_URL|DIRECT_URL)=" .env.local) && set +a && npx prisma db push
```

---

## 6. Deploy slash commands to your server

```bash
cd ../bot
npm run deploy-commands
```

Should print `✅ Deployed 12 commands.`

Re-run this whenever a command is added or its definition changes — new slash
commands do not appear in Discord until it is run.

---

## 7. Run locally

```bash
# Terminal 1
cd web && npm run dev

# Terminal 2
cd bot && npm run dev
```

Open http://localhost:3000.

---

## 8. Deploy to production

### Web → Netlify
1. Push repo to GitHub (already done)
2. Netlify → **Add new site** → **Import from GitHub** → pick `fortify`
3. Base directory: `web`  ·  Build command: `npm run build`  ·  Publish: `.next`
4. **Site settings → Environment variables** → paste every variable from `web/.env.local`
5. Update `AUTH_URL` to your Netlify URL (e.g. `https://fortify.netlify.app`)
6. Add the same URL to Discord OAuth2 redirects

### Bot → Railway
1. Railway → **New project** → **Deploy from GitHub** → pick `fortify`
2. Root directory: `bot`
3. **Variables** → paste every variable from `bot/.env.local`
4. Deploy. Logs should show `✅ Fortify bot online as ...`

### PayPal Webhook
1. https://developer.paypal.com/dashboard/applications → your Fortify app
2. **Webhooks** → Add webhook
3. URL: `https://<your-netlify>/api/paypal/webhook`
4. Events: `BILLING.SUBSCRIPTION.ACTIVATED`, `CANCELLED`, `SUSPENDED`, `EXPIRED`, `PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`
5. Copy the Webhook ID → `PAYPAL_WEBHOOK_ID` in Netlify env vars

### Whop Billing
Whop runs **alongside** PayPal, not instead of it. A user connects their Whop
account from `/dashboard/settings`; a server-side membership lookup resolves
their tier. PayPal keeps ownership of the `Subscription` row if one exists, and
a lapsed Whop membership can never downgrade a paying PayPal customer.

1. **App** — https://whop.com/dashboard → Developer → Apps. Register redirect
   URIs (exact, no trailing slash):
   `https://<your-domain>/api/whop/callback` and
   `http://localhost:3000/api/whop/callback`. Scopes: `openid`, `profile`, `email`.
2. **API key** — Developer → API keys, company-scoped (`apik_` prefix). Enable
   permission `access_pass:basic:read`. Despite the env var being named
   `WHOP_APP_API_KEY`, this is a **company** key, not an App key — `/v5/app/*`
   403s with it, which is fine because the code uses `/v2/memberships`.
3. **Plans** — all three paid tiers are separate renewal **plans under one
   product**, so the tier is carried by the plan id, not the product id.
4. **Webhook** — Developer → Webhooks → Create. URL must be the **full path**
   `https://<your-domain>/api/whop/webhook` (a bare domain returns a cheerful
   200 from the homepage and silently grants nothing). Events:
   `membership_went_valid`, `membership_went_invalid`. Copy the `ws_` secret →
   `WHOP_WEBHOOK_SECRET`.
5. **Env vars** (Netlify): `WHOP_CLIENT_ID`, `WHOP_APP_API_KEY`,
   `WHOP_REDIRECT_URI` (production URL), `WHOP_PLAN_PRO`, `WHOP_PLAN_ELITE`,
   `WHOP_PLAN_APEX`, `WHOP_WEBHOOK_SECRET`.

Two things about the public storefront, both true as of 2026-08-23 and both
verified against the API rather than the dashboard:

- **No custom route is set.** `GET /api/v2/company` returns
  `"route": "biz_qe2CAq2m6FpqX8"`, so the public page is literally
  `whop.com/biz_qe2CAq2m6FpqX8`. Claim a slug before that URL is put in front
  of anyone.
- **The product is hidden.** `GET /api/v2/products/prod_31wBhBvvQRh1x` returns
  `"visibility": "hidden"` — reachable by direct link, absent from listings and
  from anything that relies on discovery.

### Affiliate programme (Whop-native)
Whop has a built-in affiliate system — tracked links, attribution and payouts
are handled by Whop, so there is **no Fortify code involved**. Configure it on
the product in the Whop dashboard: enable affiliates, set the commission rate,
and choose recurring vs. first-payment-only.

Two things to decide before switching it on:

- **It only sees Whop checkouts.** PayPal signups are invisible to Whop's
  attribution, so affiliate links must point at Whop checkout (or at a page
  that sends people there) or commissions will silently never trigger.
- **Commission has to clear per-user cost.** AI spend per user is real and
  varies by tier — price the rate against the heaviest user on each tier, not
  the average, and remember a recurring rate compounds on a £199/mo Apex sub.

Do not invite affiliates until a real membership has been tested end to end. An
affiliate link pointing at a checkout that doesn't provision a tier costs you
commission and a customer at the same time.

---

## 9. Smoke test

1. Visit your Netlify site
2. Click **Get started** → log in with Discord
3. Land on `/dashboard`, generate a hook → should work
4. In Discord, run `/hook topic: building in public` → should work
5. Subscribe to Pro on `/pricing` with a real PayPal account → should grant Pro role

---

## What's built

Billing and accounts, the full dashboard tool set (Hook Generator, Brand Voice,
Funnel Auditor, Outreach, Trend Radar, Competitor tools, Recon, Workflows, Lead
Extractor, Company DNA, Matchmaking and more), the member directory, forums, deal
board, mastermind pods, the notification system, and 12 Discord slash commands.

The dashboard nav is the accurate inventory — it is generated from what actually
exists, so it beats any list kept here.

## Known gaps

- **Analytics** — built, but blocked on Google OAuth (app unpublished / no test
  users, so Connect Google returns Error 400). Gated behind the coming-soon page.
- **Virality Engine** — media now uploads to R2, but TikTok publishing returns
  "coming soon" pending Content Posting API approval. YouTube and Facebook publish
  paths are complete. Gated behind the coming-soon page.
- **Whop billing** — live. OAuth, membership lookup, webhook grant/revoke and
  the settings UI are deployed. Not yet exercised against a real membership, so
  the shape of the `plan` field on a live membership row is still inferred.
- **Affiliate programme** — not enabled. Whop-native, dashboard-only; blocked on
  the commission decision and on the end-to-end membership test above.
- **Twitter / Notion workflow nodes** — real implementations, need env vars only.

## Gotchas worth knowing

- **Prisma uses `db push`, not `migrate`** — and the CLI won't read `.env.local`.
  See step 5.
- **`CRON_SECRET` changes need a redeploy.** Until then every scheduled job 401s,
  and a 401 looks like a healthy HTTP response to the scheduler.
- **The Whop webhook secret is used as a RAW UTF-8 key**, `ws_` prefix included
  — do not base64-decode it. Whop's SDK examples base64-*encode* the secret
  before handing it to the Standard Webhooks verifier, which base64-*decodes*
  it, so the two cancel out. Decoding it yourself yields a garbage key and every
  delivery 401s with nothing in the logs explaining why.
- **Whop's dashboard "send test webhook" button omits the signature header** and
  sends an empty `data` field, so it always 401s. That is expected and does not
  mean the secret is wrong — only a real membership event proves the path.
- **Railway doesn't auto-deploy.** Push bot changes, then redeploy by hand.
- **Both Discord intents must be enabled** or the bot won't start. See step 3A.
- **Don't keep the repo in OneDrive.** It corrupts `node_modules` and creates
  `*-DESKTOP-*.*` conflict files.
