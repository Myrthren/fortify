# Billing, onboarding and workflows update: acceptance checks

The code checks below can run locally. The live checks require a deployed preview connected to the real services. Use a test member account; do not place payment credentials in Git or issue comments.

## Automated checks

From `web/`, run `npx prisma generate`, `npx tsc --noEmit`, `npm run test:whop`, and `npm run test:workflows`.

## Billing and access

1. In Settings, confirm the tier, billing provider, subscription status and Whop link reflect the test account. A PayPal account linked to Whop must still say PayPal owns access.
2. Use **Refresh access** on a Whop membership. Confirm the tier and Discord role match the live membership. Downgrade and expire the Whop membership, refresh again, and confirm the tier falls to the correct level. Repeat after disconnect; a stale lookup must not restore access.
3. Use **Refresh access** on a PayPal account. Confirm it repairs the Discord role from Fortify's recorded tier without changing the PayPal subscription row. Billing changes still arrive through PayPal's webhook.
4. Temporarily remove the bot's role management permission on a test server. A role mismatch should be reported as an error, not a successful repair. Restore the permission afterwards.
5. Check cancellation links and the warning that disconnecting Whop does not cancel billing.

## Onboarding

1. Open a new account's dashboard. The three steps should show profile, Company DNA and first tool as incomplete.
2. Complete each step and revisit the dashboard. Progress should update from saved data; once all three are complete, the checklist disappears.
3. On a test subscription, run the day 1, 3 and 7 onboarding job at the appropriate test times. The message should point to the first unfinished step. Turning off onboarding tips must prevent the DM.

## Workflows

1. Create each starter. Confirm it opens as an inactive draft, with connected nodes and no delivery action.
2. Confirm an empty workflow, missing schedule, missing webhook secret and disconnected trigger cannot be activated. The reason should appear on the list or in the editor.
3. Activate and run a starter on a test account with capacity. Confirm the run history shows node output and capacity use. Force a node error, then confirm its message appears in the workflow list and the detailed run log.
4. Confirm a failed delete or save leaves the workflow visible and shows an error.
5. Set a schedule to `0 8 * * *` with timezone `Europe/London`. Confirm it runs at 08:00 local time in both winter and summer. Invalid timezone names and zero-step expressions must be rejected before activation.

Do not claim the payment or Discord paths are live verified from automated tests alone. The current one-subscription-row model also requires support for customers who try to pay through PayPal and Whop simultaneously.
