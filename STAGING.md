# Permanent staging

Status: prepared, not provisioned. Production has not been changed.

## Fixed targets

- Repository: Myrthren/fortify; persistent branch: `staging`.
- Starting application: PR #9 Groq fallback, commit c4b49270a4abf403a643095499eee9b0111bd8ca.
- Railway workspace: c6ecafa9-e645-4add-b970-f8cbc9b6e577.
- Separate project: fortify-staging, 391c5fb1-9290-43f1-8b37-0ebdc7c7bb85.
- Environment: staging, 5d2c1ee9-4d39-4992-b23e-c9043bd0a2dc.
- Web service: web-staging, 4d828459-b26e-40e7-9a6c-210227ebb55d.
- Database: Postgres; private database name: fortify_staging. No public TCP proxy.
- No bot service is duplicated. The production bot remains in its original project.

## Hosting configuration

Web root `/web`; config `/web/railway-staging.json`; source follows only `staging`.
Build `npm run build`; start `npm run start -- --hostname 0.0.0.0`.
Before starting, `node scripts/staging-prepare.cjs` validates isolation and runs
`prisma db push --skip-generate` against the empty dedicated database. No
`--accept-data-loss` or production data import is permitted. Later destructive
schema changes stop for review. This command cannot run in the production project.

The connector cannot apply build settings or generate a domain until the staged
web service has a live service instance. Those two steps remain pending; the
source, database template and non-secret variable references are staged. On
activation, configure the web root/config file immediately and then redeploy;
an initial unconfigured build may fail safely.

Keep staged resources unapplied until K approves additional Railway usage.
Web sleep mode should be enabled; it can introduce a cold start. Resource limits
are runtime caps, not a monthly spending cap. Railway charges for database,
web compute, storage and egress. Check measured usage after the first test.

## Private configuration (Railway dashboard only)

Non-secret variables and private Postgres references are already staged.
`DATABASE_URL` and `DIRECT_URL` must both reference `${{Postgres.DATABASE_URL}}`.
`FORTIFY_ENV=staging`, `AUTH_TRUST_HOST=true`, the existing Discord client ID,
and the owner's Discord ID are configured. Only that Discord account may sign in.
Its staging account gets APEX and 10,000 test credits on sign-in, without billing
or Discord-role changes; these grants exist only in the separate staging database.

K must privately set:

- `AUTH_SECRET`: a new random secret of at least 32 characters; do not reuse production.
- `DISCORD_CLIENT_SECRET`: from the existing Fortify Discord application's OAuth2 page.
- `GROQ_API_KEY`: the intended Groq key, entered privately. OAuth connector cannot read values.
- `AUTH_URL`: the exact HTTPS domain generated for web-staging, once its service instance exists.

Do not copy the production environment wholesale. Leave Anthropic and OpenAI
keys absent for the initial Groq-only acceptance test. Do not set bot, mail,
payment, scheduler or storage credentials. The bootstrap rejects these credential
families. Staging API middleware also rejects cron, outbound, payment and
integration routes. No Netlify scheduled functions run under Railway hosting.

## One account setup session

1. Approve staging resource usage, then apply the reviewed staged configuration.
2. Generate the web service's Railway domain. No custom domain is required.
3. Set the four private values above in Railway. Never paste them in chat or git.
4. In Discord application 1497398931930349809, add exactly
   `<staging-origin>/api/auth/callback/discord`; preserve both production callbacks
   and preview #9's callback. This is an OAuth access change requiring K's approval.
5. Redeploy staging. Its pre-deploy guard will refuse to start until configuration
   is complete. Complete Discord sign-in once on the stable staging origin.

## Acceptance and release

Read status, build/runtime logs and failures through the Railway integration,
using the exact project/environment/service IDs above. Never accept or deploy a
pending change in the production project as part of this procedure. GitHub
statuses are available directly via the GitHub integration; no browser required.

Run from `web`: `npm run test:fallback`, `npm run test:staging`, `npx tsc --noEmit`.
Check `/api/staging_health` returns 200 with environment `staging` and the expected
revision, then verify login remains on the same origin. An unrelated Discord
account must be rejected. Do not disable PKCE or share cookies across hosts.

Generate a hook and outreach draft from a clearly fictional test brief; inspect
factual support. Create a separate truthful saved voice for voice tests. Verify a
tool round with a harmless read operation; do not send outreach or publish posts.
Missing primary-provider keys exercise the direct Groq path; quota fallback after
an actual Anthropic failure is still a separate acceptance scenario. Mock tests
do not prove a live key or model quota.

Railway staging validates application behavior, not Netlify-specific function
packaging, middleware or scheduled-job hosting. A reviewed release still requires
a Netlify preview acceptance check before production promotion. Keep PR #9 and
the broader PR #8 separate: PR #8 requires its own schema rollout and review.

The existing Netlify production deploy remains refine-core-product-features at
752b3b1 (last observed 15 October). Main remains ebe89b9. Neither was updated.
Preview #9's AUTH_URL/callback were corrected earlier, but successful sign-in and
live Groq output have not yet been verified. Do not describe the fix as released.
