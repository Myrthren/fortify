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

- **Web**: Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui, NextAuth v5 (Discord)
- **Bot**: discord.js v14, TypeScript
- **DB**: Postgres via Supabase, Prisma ORM
- **Payments**: PayPal Subscriptions API
- **AI**: Anthropic (Claude), OpenAI, Brave Search
- **Email**: Resend

## Tiers

| Tier | Price | Role |
|---|---|---|
| Free | $0 | Recruit |
| Pro | $29/mo | Soldier |
| Elite | $79/mo | Knight |
| Apex | $199/mo | Apex |

## Setup

### 1. Install
```bash
cd web && npm install
cd ../bot && npm install
```

### 2. Environment
Copy `.env.example` → `.env.local` in both `web/` and `bot/`. Fill in every value.

### 3. Database
```bash
cd web
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run locally
```bash
# Terminal 1 — site
cd web && npm run dev

# Terminal 2 — bot
cd bot && npm run dev
```

## Deploy

### Web → Netlify
- Connect the GitHub repo, set base directory to `web`
- Add all `web/.env.example` variables in Netlify env settings
- Build command: `npm run build` · Publish directory: `.next`

### Bot → Railway
- New project from GitHub repo, root: `bot`
- Add all `bot/.env.example` variables
- Start command: `npm start`

### PayPal Webhook
After deploy, set webhook URL in PayPal Developer Dashboard:
`https://<your-netlify-domain>/api/paypal/webhook`

Subscribe to: `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`.
