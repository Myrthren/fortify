# Operational workspace upgrades

The dashboard now prioritises work the signed-in member can act on: saved prospects, due follow-ups, the latest workflow failures and competitor page changes. Activity also includes saved generations and Recon results. Empty accounts show an honest first-use state. The dashboard refreshes its activity snapshot every minute and on returning to the tab; failed refreshes retain the previous snapshot and show an update warning.

## Goal-based setup

Members can choose Find clients, Create content or Watch my market, change the choice later, or skip setup. The selection and dismissal state are stored per member in WorkspacePreference. Completion follows actual saved leads, drafts, generations, watched topics and competitor watches. Free accounts receive routes they can use without a paid upgrade. Business context is a suggestion rather than a prerequisite.

## Connected lead pipeline

The pipeline extends the existing LeadStatus model, retaining the user-and-URL unique key and all existing Recon statuses. Stages are Found (`new`), Qualified, Draft ready, Contacted, Replied, Won and Lost (`dead`). Existing status values are preserved. New fields hold the prospect name, research, contact email, notes, draft and follow-up date.

Members explicitly save leads from Recon, Lead Sourcing, Lead Extractor and Weekly Lead Packs, or add one manually. Re-saving a prospect preserves its stage, notes and edited draft. Imported pack drafts populate new records only. Source URLs accept http/https, exclude embedded credentials, and remove tracking parameters. No lead is automatically emailed.

Opening a saved prospect in Cold Outreach brings its research into the form. Successful generation saves both the normal generation history and the lead's draft. Only early stages advance to Draft ready; Contacted, Replied, Won and Lost are never regressed. If another tab changed the lead, the new draft remains in generation history and the user sees an explicit warning instead of a claim that the lead was updated.

Follow-up dates use UTC calendar dates consistently, including the date input and due filters. Won and Lost prospects are excluded from due follow-ups. Pipeline stage counts cover the whole account; search and filters run on the server and paginate 100 results at a time. Selecting a saved lead from dashboard activity loads it even if it is outside the first page.

## Access and concurrency

Every new workspace endpoint requires a non-empty authenticated member ID and scopes reads and writes by that ID. Mutations also validate same-origin requests and input lengths. Lead edits use the last loaded updatedAt timestamp; cross-account changes return 404 and stale writes return 409. Unsaved lead details are retained while searching, and switching prospects prompts before discarding edits. Draft generation requires saving form edits first.

## Deployment and checks

Production Netlify builds run the additive, idempotent `prisma/workspace-upgrades.sql` changes using existing secrets inside Netlify. The build verifies the new table and lead columns before publishing. The migration adds columns and one preference table; it does not delete or reset existing lead data. Local builds and deploy previews skip database writes. Both Prisma schemas describe the additions.

Run `npm run test:workspace`, `npm run test:theme`, and the TypeScript check. Tests cover account isolation, origin restrictions, malformed input, import deduplication, preservation of existing work, optimistic concurrency, calendar dates, usable free-tier goal paths, real activity derivation and linked outreach generation. Visual previews in outputs/fortify-workspace-upgrades use explicitly labelled sample data, separate from production account data.
