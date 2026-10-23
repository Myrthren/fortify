# Fortify content and decision workspaces

The first functional release is implemented in this checkout. Signal Atlas, Story Forge and Content Test Track live in `/dashboard/content`; Decision Room lives alongside Plans at `/dashboard/decisions`. Logo Intelligence is retired separately. Production deployment is a separate step.

## Implemented release

- Clear task names, a three-step guide in each workspace, empty states and explicit save/reload controls.
- Account-owned PostgreSQL records with version checks, a bounded change history and dashboard activity links. Failed or stale saves retain edits on screen.
- Signal Atlas: attributed manual observations, optional configured Brave search snippets, topic groups, pin/coverage switches, editing/regrouping, list view and source-linked story creation. Search dates are collection dates, and snippets are not represented as full-page quotations.
- Story Forge: five editable beats, wording locks, saved alternative openings, full-text feed preview, evidence checks, approval, text export and linked tests. Optional single-beat writing suggestions use the existing voice/provider stack and Company DNA. Suggestions need explicit acceptance.
- Test Track: saved media or hosted video playback, local device previews, timed observations/suggestions, up to four versions, publication/audience context and manually entered results. Unknown measurements remain unknown. Device videos are not uploaded or persisted. Automated video analysis and connected analytics are future work.
- Decision Room: question, options, cost/time assumptions, requirements, tradeoffs, evidence, review date and outcome review. Commitment atomically creates one real FuturePlan with task cards and a review milestone. Linked plans are snapshots, and no procedure executes automatically.
- Existing generation results remain in Activity. Earlier strategy sessions and monthly Growth Briefs remain in `/dashboard/decisions/archive`. Existing bookmarks redirect to the replacement workspaces.
- The existing slideshow creator remains accessible through Test Track at `/dashboard/content?view=test&assets=slideshow`.
- Access remains Free for Story Forge, Pro for Signal Atlas, Elite for Test Track, and Apex for Decision Room.

Storage is additive: `prisma/content-workspace.sql` and the `ensure-content.cjs` production Netlify build hook create the table before deployment. Other environments should apply that SQL to their intended database and regenerate Prisma before running the app. This implementation task does not mutate the production database or publish a deployment.

Validation: `npm run test:content`, existing workspace/Plans/Advisor/theme suites, TypeScript, a production build and isolated browser checks of the actual components. Browser rendering fixtures are kept outside the web app; they are not production data. The concept sections below preserve the larger direction and explicitly identify later-stage functionality.

## Content Inspiration → Signal Atlas

An interactive map of audience questions, frustrations and buying objections. Topic clusters open into source cards containing the actual excerpt, URL, observation date and source type. Cluster size reflects an explicitly labelled count of collected observations; it is not a claim about total market demand.

Users can pin a question, merge duplicate themes, reject a misleading connection and turn selected evidence into a content brief. Filters expose recent observations, recurring questions and topics the user's own content has already addressed. Every proposed angle retains explicit links to the sources supporting it.

Visual treatment: a restrained monochrome constellation, expanding source cards and a chronological signal trail. Provide a list view for dense reading and keyboard access.

Example: a bookkeeping business sees repeated questions about irregular income, opens the supporting discussions and creates a brief explaining a practical cash-buffer method.

First release: saved, correctly attributed research from existing search sources and user imports; editable clusters; source-backed briefs. Later: historical observations and connected first-party comments. Measure research-to-brief completion and user corrections, rather than inventing an opportunity score.

## Hook Generator → Story Forge

A visual editor that develops one idea into a complete post or short-video story. The central ribbon contains opening, problem, evidence, payoff and next-action cards. Alternative openings branch from the same brief so users can compare real versions without losing their work.

Selecting a card rewrites only that part. Users can change pacing or tone while retaining approved facts, lock wording, attach their own media and compare edits. A platform preview shows the real script, line breaks and caption layout. Unsubstantiated claims are highlighted for review.

Visual treatment: a horizontal storyboard with expandable branches, a phone/feed preview and clear before/after text differences. The saved story is the primary object; generation is one editing operation.

Example: choose a question from Signal Atlas, compare three openings, keep one, arrange the explanation and save an approved script in the existing brand voice.

First release: briefs, persistent story cards, branch comparisons, factual evidence links, platform previews and export. Later: production assets and publishing handoffs. Measure how many drafts become approved or published pieces and how much revision users need.

## Virality Engine → Content Test Track

A workspace for inspecting actual media and learning from published versions. A playable timeline connects observations and editorial suggestions to specific moments. The opening seconds, captions, speech and scene changes can be inspected directly instead of inferring the entire video from its title.

Users create a version around one explicit hypothesis, such as changing the opening demonstration. The workspace keeps the original, proposed edit, approval, publication reference and observed results together. Retention curves and engagement metrics come from supported connected accounts or clearly labelled manual entry. Comparisons disclose different audiences and publication times; they are not automatically causal experiments.

Visual treatment: a video filmstrip, time-anchored annotations, side-by-side versions and a performance replay using actual observations. Omit a universal viral probability score.

Example: compare a generic introduction with a version that demonstrates the result immediately, then review real audience retention after publication.

First release: media playback, version/hypothesis tracking, review notes and manual result entry. Automated time-coded media analysis and platform analytics require additional implementation. Existing publishing integrations can provide supported handoffs. Measure completed learning cycles and recorded content outcomes.

## AI Advisor → Decision Room

A persistent workspace for one important business decision. Place the question at the centre, alternatives in comparison lanes and evidence in an adjacent dock. Each option records its requirements, trade-offs, cost assumptions, missing information and review date.

Users can vary explicit assumptions and inspect dependency consequences. Any estimated benefit is labelled as an assumption, not presented as a forecast produced by AI. Missing evidence becomes a research task. Choosing an option creates linked milestones and tasks in Plans, with relevant existing procedures attached for review.

Visual treatment: an expandable decision map, visible evidence connections, an assumption control panel and a history showing what changed and why. Keep long explanations in a readable side panel.

Example: compare improving the booking journey, revising the offer or increasing outreach; record the evidence for each; choose one; follow its tasks; return on the review date to record what happened.

First release: persistent decisions, sourced options, assumptions, links to Plans and outcome reviews. Live metric retrieval must be built explicitly; a connected account name does not supply its performance data. Measure decisions followed through and reviewed against real outcomes.

## Suggested sequence

1. Ship Signal Atlas and Story Forge together, reusing search, voice profiles and Company DNA.
2. Build Decision Room on the existing Plans foundation.
3. Introduce Content Test Track with manual measurements, then add real media analysis and supported analytics integrations.

The visual language remains Fortify's graphite surfaces, silver accents and Sci-fi typography. Movement communicates a meaningful state change. Evidence, saved work and measured outcomes supply the product's lasting value.
