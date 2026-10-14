# Fortify buyer-readiness refinement session

## Implemented

- Lead requests reserve credits atomically and refund ordinary empty/malformed/provider failures idempotently. Returned URLs must match research sources; each lead includes provenance/date and is labelled discovered/unverified. A qualification signal requires an exact quote from the returned source excerpt; it still requires human review.
- Bounded Company DNA and saved voice inform core writing tools and workflow AI. Explicit No voice is respected. Private client contexts are owner-scoped and selectable in hooks, outreach, leads, watches and workflows. Missing client voice never falls back to the account voice. Pro/Elite/Apex support 3/20/100 contexts; these are not team accounts or shared access.
- Competitor Watch compares readable page text, excluding common navigation/script/footer/cookie noise. Reports include observed added/removed quotes, source URL and conservative relevance, with baseline/unchanged/changed/failed states. Failed pages retain their last good baseline. Scans use a lease and atomic credits; total fetch failure refunds scan credits. Watch creation commits its debit and ledger alongside the watch.
- Workflow schedules are checked every minute, support configured timezones and bounded five-minute catch-up, and deduplicate repeated local times at DST fallback. A transactional owner lock reserves capacity; persistent unique run keys stop overlapping scheduler/manual retries repeating a run. Stale running jobs become interrupted and are not automatically replayed. Safe reads/AI and idempotent Resend email may retry; arbitrary external mutations do not.
- Website research -> content drafts reads a public page and feeds source text/URL into AI with saved context/voice. Competitor change -> content drafts consumes observed watch evidence. Both save drafts in run history and have no publishing actions. Research starter requires a URL; change starter rejects a manual run without observed changes.
- Contact checks distinguish domain-only DNS from opt-in Hunter mailbox checks, catch-all, disposable, pending, restricted and inconclusive results. Outbound engine requires a current owner-scoped deliverable Hunter check. Verification is not consent, buying intent or an inbox-placement guarantee. CSV exports retain check status/provider/date.
- Pricing/onboarding/canonical knowledge describe actual budgets, scan charges, draft versus delivery behavior and client scope. Authenticated dashboards render at request time rather than attempting database access during static build. Sentry build telemetry is disabled.

## Local validation

Web Prisma generation and TypeScript checks passed. 49 readiness regression tests, 14 Whop tests and 4 starter tests passed (67 total). Full production build passed with inert provider/database values, empty Sentry credentials and telemetry disabled. Bot Prisma generation and TypeScript checks passed in the first batch. Tests use isolated service/database mocks; successful compilation is not a live service check.

## Deployment order

1. Review the additive SQL in `web/prisma/refinement-session.sql` against the actual database schema in a preview/staging environment. It is generated from PR #8 first-batch schema to the current schema. Back up and inspect schema drift first; do not blindly run it twice or use a destructive reset. Existing scan history defaults to unchanged; old hash-only watch links establish a fresh readable baseline on their next successful scan.
2. Apply the additive schema change before deploying web code. Generate the Prisma client during build. These new web models do not alter existing bot models. Keep the added columns/tables if rolling web code back; deleting them would discard verification/context/history data.
3. Configure a nonempty CRON_SECRET and correct NEXTJS_URL. Deploy web and scheduled functions together. Enable EMAIL_VERIFICATION_ENABLED=true only with an authorised HUNTER_API_KEY and provider budget. Without this configuration, checks remain domain-only and outbound sending is held.
4. Redeploy the Discord bot for first-batch knowledge/tier changes. Existing informational posts are not automatically edited.
5. Execute the live acceptance checks below before marking the PR ready or widening sales claims.

## Live acceptance required

Use authorised test accounts and existing billing sandbox arrangements. Do not make a real purchase or send messages to prospects as part of these checks.

1. Free/paid onboarding and billing: prove the available Free sample, paid activation, tier/role repair, downgrade, cancellation and return-to-app behavior using `UPGRADE_ACCEPTANCE.md`.
2. Output quality: save business context/voice, configure Website research -> content drafts with a readable public page, run it and inspect source accuracy, relevance and voice. Repeat with explicit No voice and no saved context.
3. Owner/client isolation: two accounts cannot read/edit/select each other's contexts, voices or checks. Switch Client A/B across supported tools; verify labels, evidence and drafts use only the selected client. Pin matching client contexts to a watch and competitor workflow; other clients' changes must not trigger it.
4. Watch evidence: establish baseline, change a staging page's price, verify exact before/after/source and one alert. Noise-only changes should not trigger. Force 404/timeouts; record failure, preserve baseline and refund only when all links fail. A partial usable scan charges once. JavaScript-only/paywalled pages may be unsupported and need manual review.
5. Database concurrency: with exactly 50 credits submit two lead searches; at most one reserves. Repeat with exactly 25 credits and simultaneous watch creation. Replay a refund and overlapping scans/scheduler ticks. Verify nonnegative balances, one ledger debit/run and one source-event run. Mock tests do not establish PostgreSQL locking behavior.
6. Schedule reliability: test half-hour schedules, Europe/London DST, repeated ticks and a delayed tick inside/outside the five-minute window. Inspect deferred/errors counts. Scheduler processes four fresh jobs per minute and two due watches per five minutes; monitor backlog. Source events are retained for triggering for 24 hours; long outages are not fully backfilled.
7. Verification: prove domain-only without provider, deliverable/catch-all/invalid/pending/restricted/stale outcomes with provider, CSV dates and the outbound hold. A failed hold must be explicitly queued again after verification. No provider key or live mailbox checks were available locally.
8. Delivery retries in an authorised staging destination: simulate an ambiguous Resend response; same run/node/loop key must prevent duplicate mail. Discord/Slack/Notion/other mutations are not auto-retried. At-most-once run claiming can leave interrupted work; it is not exactly-once delivery across all services.
9. Crash recovery: process death after a credit reservation still requires ledger reconciliation. Database outages/refund failures and interrupted deliveries require operator review; automatic durable recovery is not implemented.

## Remaining scope

Full team membership/invites/roles/shared billing, exhaustive source claim verification, guaranteed conversion/deliverability, durable crash recovery and live production/payment/Discord checks remain open. No production migration, merge, deployment, real purchase or prospect outreach was performed in this session.
