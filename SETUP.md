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
3. Enable: Server Members Intent

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
https://discord.com/oauth2/authorize?client_id=1497398931930349809&permissions=268435456&scope=bot%20applications.commands
```

---

## 4. Fill `.env.local` files

Copy `.env.example` → `.env.local` in both `web/` and `bot/`. Fill every blank.

Generate `AUTH_SECRET`:
```bash
openssl rand -base64 32
```

---

## 5. Migrate the database

```bash
cd web
npx prisma migrate dev --name init
npx prisma generate
```

---

## 6. Deploy slash commands to your server

```bash
cd ../bot
npm run deploy-commands
```

Should print `✅ Deployed 3 commands.`

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

---

## 9. Smoke test

1. Visit your Netlify site
2. Click **Get started** → log in with Discord
3. Land on `/dashboard`, generate a hook → should work
4. In Discord, run `/hook topic: building in public` → should work
5. Subscribe to Pro on `/pricing` with a real PayPal account → should grant Pro role

---

## What's built

✅ Landing page  
✅ Pricing page with PayPal subscription buttons  
✅ Discord OAuth login  
✅ Dashboard  
✅ Hook generator (OpenAI, web + Discord)  
✅ PayPal activate + webhook + Discord role sync  
✅ Free-tier daily limits  
✅ Welcome email (Resend)  
✅ Bot commands: `/hook`, `/upgrade`, `/profile`

## What's next (build incrementally)

- Brand Voice Studio (Claude with prompt caching)
- Funnel Auditor (Brave + Claude)
- Trend Radar (daily Brave scrapes + email digest)
- Cold Outreach Generator
- Competitor Scanner
- Weekly Strategy Reports (Sunday cron)
- Member directory + AI matchmaking
- Deal board
- Mastermind pods
- More Discord commands (`/voice`, `/audit`, `/research`, etc.)
