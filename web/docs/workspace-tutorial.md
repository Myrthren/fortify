# First-plan workspace tutorial

The five-step workspace tutorial introduces business context, tool discovery,
saved activity, and AI/credit usage through the real shared controls. It does
not create work, send a message, run a workflow or spend credits. The final AI
option opens the assistant without sending a prompt. The existing Simulation
Lab practice walkthrough remains separate.

## First purchase and persistence

- The existing verified PayPal activation transaction enrolls a member only if
  they have no previous subscription record. The user row is locked and the
  enrollment and subscription write commit together.
- Whop enrolls only when verified membership reconciliation creates the first
  subscription, in the same serializable transaction as the entitlement.
- Enrollment uses an upsert with an empty update. Provider retries, renewals,
  upgrades, reconnects and later purchases never reset it. Existing subscribers
  are not automatically enrolled by this release; they can replay from Settings.
- The dashboard layout mounts the tutorial once, across page navigation. A
  paid member with pending progress sees it on entering the workspace. Free
  accounts never receive the purchase-triggered launch.
- Progress belongs to the authenticated account, not the device or business.
  Skip and completion persist across devices. A refresh resumes unfinished
  automatic guidance at its last saved step. Completion cannot regress to a
  skip, and stale writes cannot lower progress.
- Settings has a Replay tutorial control for signed-in members. Replay starts
  locally at the welcome step and never resets the durable completion state or
  arms another automatic launch. Reading the status cannot enroll a member.

## Interaction and recovery

The docked guide keeps the workspace usable. It highlights the account/menu,
search, activity and assistant controls as needed, adapts to mobile navigation,
and permits minimizing, resuming, going back and skipping. Search and Activity
steps advance after arriving on the real route; direct links are available as
alternatives. Opening the account menu enables the next business-context step.
Keyboard focus follows the current lesson; Escape minimizes the guide and
focuses Resume. Reduced-motion preferences suppress guide transitions.

Progress writes require authentication, the same origin, the current tutorial
version and bounded step values. Storage failures leave the workspace usable,
show a retryable error for an active tutorial, and offer Close for now without
claiming that progress was saved. Automatic status-load failures stay silent;
Settings can retry. No account identifiers from the client select the write
target, and responses are not cached.

## Storage and verification

`WorkspaceTutorialProgress` is additive. `prisma/workspace-tutorial.sql` is
included in the existing production-only `ensure-business.cjs` preparation
step. Prisma client generation is required before building. The local checks
generate the client but do not apply SQL or activate a real payment.

Run `npm run test:tutorial`, `npm run test:whop`, the navigation/workspace
regressions, `npx tsc --noEmit`, and a Next production build. Browser checks use
actual tutorial, navigation, dashboard and replay components with explicitly
labelled sample endpoints. Exercise a new buyer, returning member, completion,
skip, reload/resume, replay, both themes, phone layouts and failed saves.
