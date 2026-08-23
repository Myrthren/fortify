# 🏰 Fortify

The AI co-pilot for online business and networking — built for the Fortune Fortress community.

## Structure

```
fortify/
├── web/   → Next.js 15 site (deploys to Netlify)
└── bot/   → Discord bot (deploys to Railway)
```

Both share the same Postgres database (Supabase). The site is the product surface; the bot is the in-Discord surface. One account, two interfaces.

## Stack

- **Web**: Next.js 15 (App Router), TypeScript, Tailwind, NextAuth v5 (Discord)
- **Bot**: discord.js v14, TypeScript
- **DB**: Postgres via Supabase, Prisma ORM
- **Payments**: PayPal Subscriptions API
- **AI**: Anthropic (Claude), OpenAI, Brave Search
- **Email**: Resend (Amazon SES underneath)
- **Media**: Cloudflare R2, served from `media.fortify-io.com`
- **DNS**: Cloudflare (hosting stays on Netlify)
- **Errors**: Sentry

## Tiers

| Tier | Price | Role |
|---|---|---|
| Free | £0 | — |
| Pro | £29/mo | Pro |
| Elite | £79/mo | Elite |
| Apex | £199/mo | Apex |

Billed through **PayPal or Whop** — both grant the same tiers and Discord roles.

## Setup

### 1. Install
```bash
cd web && npm install
cd ../bot && npm install
```

### 2. Environment
Copy `.env.example` → `.env.local` in both `web/` and `bot/`. Fill in every value.

### 3. Database

This project has **no migrations directory** — the schema is applied with `db push`, not `migrate`.

```bash
cd web
npx prisma db push
npx prisma generate
```

⚠️ The Prisma CLI only auto-loads `.env`, **not** `.env.local`, so `db push` fails with "Environment variable not found: DIRECT_URL" unless you pass the vars explicitly:

```bash
set -a && source <(grep -E "^(DATABASE_URL|DIRECT_URL)=" .env.local) && set +a && npx prisma db push
```

### 4. Run locally
```bash
# Terminal 1 — site
cd web && npm run dev

# Terminal 2 — bot
cd bot && npm run dev
```

## Scheduled jobs

Every `web/app/api/cron/*` endpoint is POST-only and authenticated with an
`x-cron-secret` header matched against the `CRON_SECRET` env var.

They are triggered by **Netlify scheduled functions** in `web/netlify/functions/`
— one file per endpoint, each declaring its own cron expression. There is no
external scheduler; adding a job means adding a file, and it ships with the next
deploy.

| Cadence | Jobs |
|---|---|
| Hourly | `run-scheduled-workflows` :00, `expire-bans` :20, `auto-publish` :45 |
| Daily | `shopify-stock-check` 06:00, `shopify-out-of-stock` 06:15, `shopify-milestone` 06:30, `competitor-watch-scan` 07:00, `trend-alert` 07:30, `renewal-reminder` 08:00, `onboarding` 08:30, `payment-rescue` 09:00 |
| Mondays | `weekly-report` 09:00, `content-brief` 09:30, `match-alert` 10:00, `shopify-weekly-revenue` 10:30, `competitor-monitor` 11:00, `stripe-mrr-check` 11:30 |
| Monthly | `monthly-credits` — 1st at 00:00 |

All times UTC.

⚠️ Changing `CRON_SECRET` requires a **redeploy** to take effect. Between updating
the env var and redeploying, every job returns 401 — and a 401 still looks like a
successful HTTP response to a scheduler, so the failure is silent. After changing
it, check Netlify → Logs → Functions for `[cron] <name> → 200 OK`.

## Deploy

### Web → Netlify
- Connect the GitHub repo, set base directory to `web`
- Add all `web/.env.example` variables in Netlify env settings, plus `CRON_SECRET` and the R2 vars
- Build command: `npm run build` · Publish directory: `.next`

### Bot → Railway
- New project from GitHub repo, root: `bot`
- Add all `bot/.env.example` variables
- Start command: `npm start`
- **Railway does not auto-deploy** — trigger a redeploy manually after pushing bot changes

### DNS → Cloudflare
`fortify-io.com` is on Cloudflare nameservers, but **Netlify still builds and serves
the site**. The apex and `www` are CNAMEs to the Netlify site and are deliberately
**DNS-only (grey cloud)** — Netlify already terminates TLS and runs its own CDN, so
proxying through Cloudflare would add a second CDN layer for no benefit.

`media.fortify-io.com` is the exception: it points at the R2 bucket and **is**
proxied (orange cloud), because Cloudflare serves it directly.

### PayPal Webhook
After deploy, set webhook URL in PayPal Developer Dashboard:
`https://fortify-io.com/api/paypal/webhook`

Subscribe to: `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`.

### Whop Billing
Whop runs alongside PayPal — either provider can grant a tier. Users connect
from `/dashboard/settings`; `Subscription.provider` records which one owns the
row, and a lapsed Whop membership never downgrades a PayPal customer.

Webhook URL: `https://fortify-io.com/api/whop/webhook` (the **full path** — a
bare domain 200s from the homepage and grants nothing).
Events: `membership_went_valid`, `membership_went_invalid`.

Tiers are separate **plans under one product**, so `WHOP_PLAN_PRO` / `_ELITE` /
`_APEX` hold plan ids, not product ids. Full setup in `SETUP.md`.

### Affiliate programme
Whop-native: tracked links, attribution and payouts are all handled by Whop, so
there is no Fortify code for it. Enabled and priced per-product in the Whop
dashboard. Caveat: it only attributes **Whop** checkouts — PayPal signups are
invisible to it, so affiliate traffic has to land on Whop checkout.

## Notes for contributors

- **Don't keep this repo inside OneDrive.** OneDrive syncing `node_modules` corrupts
  installed packages (symptom: `Module not found: Can't resolve 'cookie'`, or an
  `EINVAL readlink` error on `.next/diagnostics`) and produces `*-DESKTOP-*.*`
  conflict files. Fix with `rm -rf node_modules && npm install`.
- The bot's Discord assistant has **owner-only** server admin tools. See
  `bot/src/lib/admin-tools.ts` — the security model is documented at the top of
  that file and should be read before adding a tool.
