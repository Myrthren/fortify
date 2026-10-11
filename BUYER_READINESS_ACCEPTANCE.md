# Buyer-readiness refinement: first batch

## Implemented

- Lead Sourcing validates input before an atomic credit reservation. Invalid inputs never reserve credits; empty, malformed or failed research is refunded. Refund ledger IDs prevent duplicate refunds. This applies to the endpoint and the workflow Lead Search node.
- Research results are checked against returned search URLs, deduplicated, bounded, dated and labelled discovered/unverified. This is not mailbox verification or proof of buying intent.
- A bounded Company DNA context builder is shared by web chat, hooks, outreach, lead sourcing, website competitor scans and workflow AI. Saved voice applies to hooks/outreach and workflow AI Generate. Explicit No voice is respected. Hook, outreach and lead results display which context was used.
- Pricing distinguishes drafts from automatic sending, included web chat budgets from tool credits, watch scan costs and rolling workflow capacity. The existing backend budgets and subscription prices are unchanged.
- Paid onboarding guides Company DNA → active voice → website competitor research → draft hooks. Research must still be inspected and an angle pasted into the draft tool. Free onboarding points to a free sample and clearly identifies paid access requirements; no paid trial or automatic subscription is created.
- Canonical knowledge and Discord tier descriptions are updated. Bot source changes require a Railway redeploy; existing posted Discord information is not edited automatically.

## Automated validation

From `web/`: `npx prisma generate`, `npx tsc --noEmit`, `npm run test:readiness` (23 tests), `npm run test:whop` (14 tests), `npm run test:workflows` (4 tests).

From `bot/`: `npx prisma generate`, `npx tsc --noEmit`.

41 tests passed locally. External providers, database transactions and AI responses in regression tests use isolated mocks; these tests do not prove live service reliability. A production build compiled, then failed prerendering `/dashboard/members` because it needs the database. The local check deliberately used inert database/provider values, not production credentials. Run a full build with the deployment's normal configuration before release.

## Required live checks before claiming purchase readiness

Use an authorised test account and existing test/sandbox billing arrangements. Never enter credentials in GitHub or make an unapproved real purchase.

1. New Free account: dashboard offers an available sample, not a blocked Company DNA setup. Confirm it does not grant paid features.
2. New paid account: save Company DNA, train and activate a voice, scan one public competitor, manually inspect an angle, and generate hooks. Verify output relevance and the displayed context labels. Repeat with no saved DNA/voice and with explicit No voice in Outreach.
3. Isolation: one account cannot select another account's voice or read its DNA. Saved active voice must be scoped to its owner.
4. Lead endpoint: submit invalid input, then force provider failure, empty results and malformed output in a controlled preview. Balance should remain unchanged. A successful result charges once and includes real returned-source provenance. Repeat workflow Lead Search; workflow capacity is separate and still consumed for failed runs.
5. Real database concurrency: with exactly 50 credits, submit two simultaneous lead searches. At most one may reserve 50; balance cannot become negative. Replay the refund against its reservation; balance must not increase twice.
6. Simulate process termination after a credit reservation. Automatic crash recovery is not implemented in this batch: reconcile any debit lacking a completed generation/refund from the ledger. Do not describe refunds as guaranteed after process death or database outages.
7. Workflow draft: run an AI Generate starter without delivery actions. Confirm saved context/voice materially changes the draft, logs are present and capacity is shown. No schedule reliability improvements were included in this batch.
8. Pricing and checkout: check Whop/PayPal availability, activation, correct tier, role repair, cancellation and return-to-app flow. Follow `UPGRADE_ACCEPTANCE.md`; no live payment/Discord checks were performed locally.
9. Watch pricing: confirm users understand credits are consumed per watched competitor/day and that ten watches exceed Elite's included monthly credit budget. Meaningful change summaries/noise filtering remain a separate refinement.
10. After deployment, inspect the latest canonical knowledge version. Redeploy the bot for changed command/fallback text. Repost existing informational messages only through an explicitly authorised Discord action.

## Not addressed in this batch

Mailbox verification, client workspaces/team permissions, meaningful competitor-content diffs, full source-level claim verification, scheduling/retry hardening, and a fully automatic competitor-to-content workflow. No schema migration, production deployment, scheduled prospect send or real purchase was performed.
