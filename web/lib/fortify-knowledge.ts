/**
 * CANONICAL FORTIFY KNOWLEDGE — single source of truth for the Discord bot.
 *
 * This is served at GET /api/bot/knowledge and fetched by the Discord bot at
 * chat time (cached ~30 min). Because the web app auto-deploys on every push,
 * the bot's knowledge updates automatically with no bot redeploy.
 *
 * WHEN YOU SHIP A FORTIFY FEATURE CHANGE, UPDATE THIS FILE in the same commit.
 * Bump KNOWLEDGE_VERSION so it's easy to confirm the bot has the latest.
 */

export const KNOWLEDGE_VERSION = "2026-10-26-simulation-walkthrough";

export const FORTIFY_KNOWLEDGE = `ABOUT FORTIFY
- Platform: https://fortify-io.com
- Community: the Fortify Discord server, for online business owners, resellers, and creators
- Tagline: "AI co-pilot for online business and networking"
- Owner: Kene (owner of the Fortify Discord server)

AI MODEL ALLOWANCES
- AI text and image understanding run through OpenRouter. Standard Claude requests use Sonnet 5.5 and premium requests use Opus 5.5, subject to availability.
- Included Claude allowance is shared across website, Discord, text tools and background/workflow AI: Pro £2/week, Elite £4/week, Apex £10/week. Weeks reset Monday at 00:00 UTC.
- Once a request cannot fit the remaining Claude allowance, Fortify continues using a configured alternative model. Free uses alternative models. Existing tool access, credits and anti-abuse limits still apply.
- Alternative models also have API costs; do not call them free. Never claim that an alternative model is Claude. Image generation uses a separate image provider.

SUBSCRIPTION TIERS
- Free (£0/mo): 100 starter credits, Story Forge script editor, 10 cold outreach messages/mo, Trend Radar (5 watch terms), community forums, read-only member directory and deal board
- Pro (£29/mo): Core AI tools, 500 credits/mo, Brand Voice Studio (1 voice), Funnel Auditor (5/mo), Cold Outreach (50/mo), Competitor Scanner (3 tracked), Lead Sourcing, Signal Atlas source research, Meta Ads dashboard, Shopify dashboard, Revenue/Stripe dashboard, Company DNA, Matchmaking, Lead Extractor (10 accounts/batch)
- Elite (£79/mo): Everything in Pro, 1500 credits/mo, 3 brand voices, unlimited audits & outreach, unlimited Trend Radar watch terms, 10 competitors tracked, Content Test Track, Fortify Recon, Weekly Lead Pack (15 new local leads with drafted outreach every Monday, no credits), Competitor Watch, Workflows (automation builder), Lead Extractor (25 accounts/batch + web search fallback + AI approach strategy), live web search in Discord chat
- Apex (£199/mo): Everything unlimited — unlimited brand voices, watch terms, competitors, workflows, 5000 credits/mo, monthly Growth Brief (saved in the strategy archive on the 1st of each month), Weekly Lead Pack of 25, Decision Room (decisions and linked Plans tasks), Mastermind Pods (not live yet; they launch once there are enough Apex members), auto-publish to YouTube and Facebook, Lead Extractor (50 accounts/batch + optional deep scan), live web search in Discord chat

PLATFORM FEATURES
- Weekly AI strategy report — a weekly activity summary and suggested next action sent by Discord DM, for Elite and Apex only. Requires a linked Discord account and the Weekly strategy report notification enabled in Settings. This preference also controls lead-pack DMs and Apex Growth Brief DMs.
- Apex does not include early access to new features; there is no early-access mechanism.
- Decision Room — Apex decision workspace at /dashboard/decisions. Compare user-supplied options, costs, requirements and tradeoffs, commit a choice into linked Plans tasks, and record an outcome review. Earlier strategy sessions and monthly Growth Briefs remain readable at /dashboard/decisions/archive.
Content:
- Story Forge — guided script editor at /dashboard/content?view=story (Free+). Save five editable story beats, compare alternative openings, attach supporting evidence, lock wording, request a suggestion for one beat, approve and export. Suggestions use the active brand voice where available.
- Brand Voice Studio — train Claude on your exact tone; use it in all AI tools (Pro+)
- Signal Atlas — source research at /dashboard/content?view=research (Pro+). Add real interviews, comments and observations or keep attributed web-search snippets. Group topics, inspect the original source and create a linked Story Forge draft. Search requires the configured Brave service; manual research still works without it. Counts describe collected observations, not market demand.
- Content Test Track — /dashboard/content?view=test (Elite+). Play saved media or a hosted video, preview a device file, add timed review notes, compare up to four versions, and enter real results manually. Device files are not uploaded or saved. No viral score, automated media analysis or connected analytics is supplied by this workspace.

Growth:
- Cold Outreach Generator — personalised email, LinkedIn, Twitter, and DM copy (Free: 10/mo, Pro: 50/mo, Elite+: unlimited)
- Lead Sourcing — find and score prospects against your ICP using web intelligence (Pro+)
- Lead Extractor — paste TikTok and Instagram profile URLs in bulk; Fortify researches each business (bio, linked website, contact/about pages, link-in-bio pages) and extracts their email and phone number. Pro: 10 accounts/batch. Elite: 25/batch plus web-search fallback and optional AI "approach strategy" per lead found (best angle to pitch them). Apex: 50/batch plus an optional deep scan that crawls extra pages and widens the search. (Pro+)
- AI Matchmaking — Claude surfaces top Fortify members worth talking to (Pro+)
- Fortify Recon — find local and niche businesses by location and category via Google Maps; returns name, address, phone, website, and rating, ready to prospect (Elite+)
- Weekly Lead Pack — set who to find and where once; every Monday Fortify delivers new businesses (never repeats) with published emails and a drafted cold email each, at /dashboard/lead-pack (Elite 15, Apex 25; no credits)
- Outbound Engine — COMING SOON, not available to members yet (sending is still being connected); do not tell anyone they can use it today. When live it will be a fully autonomous AI cold email system. You describe your target and your offer; it finds matching businesses, reads their websites, analyses them across 11 dimensions (website quality, lead capture, booking, CRM, chatbot, automation, SEO and more), assesses fit against your campaign’s stated offer, and writes a completely unique email to each one. Every email varies its greeting, opening, structure, tone, sign-off and call to action, is checked against a banned-phrase and fabrication filter before it can send, and is capped at 70-140 words. It sends inside your chosen hours at your daily cap, runs the follow-up sequence, reads replies straight out of your sending mailbox, and stops instantly the moment someone replies. Positive replies are DMed to you, and bounced addresses are never contacted again. Drafts wait for your approval unless you switch on auto-send. (Elite+)

Research:
- Funnel Auditor — score and fix any landing page URL with AI (Pro+)
- Trend Radar — track topics across the web (Free: 5 watch terms, Pro: 10, Elite+: unlimited plus Reddit signals)
- Competitor Scanner — detailed intel reports on rival businesses (Pro+)
- Competitor Watch — compare readable competitor web pages daily (07:00 UTC); alerts after a scan finds changed wording, with added/removed excerpts. Manual scans are also available. Private or JavaScript-only social content is not supported (Elite+)

Business:
- Business Setup — guided business context and an action blueprint at /dashboard/setup (Pro: 1 business, Elite: 5, Apex: unlimited). Create, edit, switch and remove saved businesses. Switch the active business or start a new setup from the Account menu, or Navigation on mobile. The active business informs advisor and chat context; setup does not automatically connect external software.
- Meta Ads — real campaign performance + competitor ad intel (Pro+)
- Shopify Integration — revenue, orders, and product performance dashboard (Pro+)
- Revenue Dashboard — MRR, subscriptions, and charges from Stripe (Pro+)
- Company DNA — business memory; give every AI tool context about your company (Pro+)
- Analytics — GA4 and Google Search Console in one place — COMING SOON, not available yet

Automation:
- Simulation Lab — /dashboard/research-lab. Three visual 3D environments: Research Institute, Operations Studio and Orbital Command, with six agents, shared resources, interventions and recorded replay. They share a bounded fictional engine. They do not execute real software actions or run while the page is closed. Rules mode runs locally; AI-assisted decisions require explicit server configuration and bounded request limits.
- Simulation walkthrough — an optional five-action practice guide opens on a member's first lab visit for each business (or personal workspace). Completion or skipping is remembered across devices; restart it with Walkthrough. Practice leaves the saved session intact and makes no AI calls. Simulation sessions and environment preferences remain device-local and are separated by member and business.
- Workflows — multi-step AI automation builder; triggers, logic, AI nodes, Discord/Slack/Email/Notion/HTTP actions (Elite+)

Community:
- Member Directory — browse all Fortify members
- Mastermind Pods — small accountability circles for Apex members (launching once there are enough Apex members; not live yet)
- Forums — community discussion boards
- Deal Board — post and browse community deals
- Messages — direct messaging with other Fortify members
- Connections — your network of Fortify members

Account:
- Credits — purchase credits for premium one-off actions (e.g. extra leads, recon searches, image generation)
- GDPR Data Export — download all your Fortify data as JSON from Settings
- Account Deletion — fully wipe and anonymise your account from Settings

BOT SLASH COMMANDS
- /hook <topic> — generate 5 viral hooks
- /upgrade — see tier comparison and upgrade link
- /profile — your tier, XP, streak, and credits
- /voice — list your trained brand voices
- /outreach — generate cold outreach copy
- /audit <url> — run a funnel audit on any URL
- /trends — check your Trend Radar watch terms and latest results
- /competitors — list your tracked competitors
- /matchmake — find Fortify members worth connecting with
- /ticket — raise a support ticket

PRICING
- Upgrade or subscribe: https://fortify-io.com/pricing
- Monthly plans in GBP via Whop or PayPal; both grant the same tier and Discord role
- No free trial of paid plans (the Free plan is the trial). Payments are non-refundable
- Cancel with the provider you paid through. Cancelling PayPal keeps the plan until the end of the paid month, then moves the account to Free; Whop access follows the Whop membership
- PayPal activates instantly (must be signed in). Whop needs Connect Whop in Settings afterwards (guide: https://fortify-io.com/whop)
- Credits: paid plans add credits on the 1st of each month; unused credits roll over and never expire. Typical costs: lead search 50, Lead Extractor 20 per profile, Recon from 50, competitor scans 35-50
- Affiliates: 30% commission for the first 12 months of each referred customer, Whop referral links only (PayPal purchases earn nothing). Details: https://fortify-io.com/affiliates
- Support email: support@fortify-io.com`;
