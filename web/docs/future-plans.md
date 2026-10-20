# Future Plans

`/dashboard/plans` is a private planning library. `/dashboard/plans/[id]` is a visual plan of future work, with optional references to existing software connections and Fortify workflows.

## Included

- Goals, milestones, tasks, decisions, notes, software references, procedure cards and phase groups.
- Dragging, resizing, pan/zoom, fit, canvas undo/redo, explicit saving and JSON Canvas `.canvas` export.
- Blocking prerequisites, supporting relationships and alternative paths. Blocking cycles are rejected.
- Progress and target dates. A procedure's date is an earliest launch date in UTC; other card dates are targets and do not prevent early work.
- Blank, offer launch and 90-day growth starting points; archive and restore.
- Both site themes. Phones open in an editable outline with an optional canvas view.
- Current account-link metadata for Notion, Shopify, Stripe, Google, Meta and Discord. Resource links open separately; the canvas never embeds or fetches arbitrary URLs.
- Attaching an owned workflow and explicitly reviewing and launching it when its prerequisites are complete. Existing Elite/Apex execution requirements and workflow capacity apply.

Software cards are references, not a new two-way synchronization system. The attached workflow performs its own configured actions through the existing workflow runner. Drawing an edge, reaching a date or marking a card complete never schedules or launches a procedure automatically. Independently scheduled workflows retain their existing behavior.

## Persistence and execution

Plans are scoped by signed-in user. Mutations require a matching request origin, validated documents and an optimistic version. Stale saves return a conflict while retaining the local document for export. The editor warns before leaving through links with unsaved changes and before unloading the page.

The launch request checks ownership, plan version, archived state, prerequisites, earliest launch date, tier and the reviewed workflow timestamp. The runner checks that timestamp again against the definition it actually loads.

Each procedure card receives a unique execution reservation before side effects. A completed, failed or uncertain execution cannot be launched again through the same card. Failures explicitly returned before a workflow run exists are marked `not-started` and may be reviewed and retried. Actual workflow history remains the place to investigate an interrupted or failed execution. Planning completion stays a deliberate user action.

Limits are 100 cards and 200 relationships per plan. The library currently shows the most recent 100 plans in each active/archive view. Export uses standard JSON Canvas text/group nodes and edges, with additional planning metadata. Import and collaborative editing are not included.

## Deployment

The web and bot Prisma schemas both include `FuturePlan` and `PlanProcedureRun`. The additive SQL is `prisma/future-plans.sql`; it does not replace or delete existing records. `scripts/ensure-plans.cjs` prepares and verifies these tables during Netlify production builds, after Prisma generation and before Next compilation. A preparation error stops the deployment. Other environments must apply the same SQL to their own database before using Plans.

## Verification and previews

`npm run test:plans` checks document constraints, dependency/date rules, export retention, authentication, ownership, origins, concurrency versions, account metadata, execution review, duplicate prevention and safe preflight retries. External actions are mocked in tests.

Local interactive previews are generated outside the deployed application by `../../scripts/render-plans-preview.cjs` and served by `../../scripts/serve-plans-preview.cjs`. They use labelled sample data, local in-memory saves and a blocked procedure-launch action. They contain no real integration credentials or member data.
