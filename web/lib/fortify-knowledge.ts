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

export const KNOWLEDGE_VERSION = "2026-08-09";

export const FORTIFY_KNOWLEDGE = `ABOUT FORTIFY
- Platform: https://fortify-io.com
- Community: Fortune Fortress — a Discord community for online business owners, resellers, and creators
- Tagline: "AI co-pilot for online business and networking"
- Owner: Kene (Discord owner of Fortune Fortress)

SUBSCRIPTION TIERS
- Free (£0/mo): limited access, Hook Generator only
- Pro (£29/mo): Core AI tools, 500 credits/mo, Brand Voice Studio (1 voice), Funnel Auditor (5/mo), Cold Outreach (50/mo), Competitor Scanner (3 tracked), Lead Sourcing, Inspiration Engine, Meta Ads dashboard, Shopify dashboard, Revenue/Stripe dashboard, Company DNA, Analytics, Matchmaking, Logo Intelligence, Lead Extractor (10 accounts/batch)
- Elite (£79/mo): Everything in Pro, 1500 credits/mo, 3 brand voices, unlimited audits & outreach, Trend Radar (10 watch terms), 10 competitors tracked, Virality Engine, Fortify Recon, Competitor Watch, Workflows (automation builder), Lead Extractor (25 accounts/batch + web search fallback + AI approach strategy), Outbound Engine (autonomous AI cold email), live web search in Discord chat
- Apex (£199/mo): Everything unlimited — unlimited brand voices, watch terms, competitors, workflows, 5000 credits/mo, Mastermind Pods access, auto-publish, Lead Extractor (50 accounts/batch + optional deep scan), live web search in Discord chat

PLATFORM FEATURES
Content:
- Hook Generator — 5 viral hooks on any topic (Free+)
- Brand Voice Studio — train Claude on your exact tone; use it in all AI tools (Pro+)
- Inspiration Engine — mine Reddit, YouTube, and the web for content angles (Pro+)
- Virality Engine — AI video scoring, trend analysis, competitor content intel (Elite+; auto-publish Apex only)
- Logo Intelligence — AI analysis and improvement suggestions for brand logos (Pro+)

Growth:
- Cold Outreach Generator — personalised email, LinkedIn, Twitter, and DM copy (Pro+)
- Lead Sourcing — find and score prospects against your ICP using web intelligence (Pro+)
- Lead Extractor — paste TikTok and Instagram profile URLs in bulk; Fortify researches each business (bio, linked website, contact/about pages, link-in-bio pages) and extracts their email and phone number. Pro: 10 accounts/batch. Elite: 25/batch plus web-search fallback and optional AI "approach strategy" per lead found (best angle to pitch them). Apex: 50/batch plus an optional deep scan that crawls extra pages and widens the search. (Pro+)
- AI Matchmaking — Claude surfaces top Fortune Fortress members worth talking to (Pro+)
- Fortify Recon — find local and niche businesses by location and category via Google Maps; returns name, address, phone, website, and rating, ready to prospect (Elite+)
- Outbound Engine — a fully autonomous AI cold email system. You describe your target and your offer; it finds matching businesses, reads their websites, analyses them across 11 dimensions (website quality, lead capture, booking, CRM, chatbot, automation, SEO and more), works out where automation would genuinely help, and writes a completely unique email to each one. Every email varies its greeting, opening, structure, tone, sign-off and call to action, is checked against a banned-phrase and fabrication filter before it can send, and is capped at 70-140 words. It sends inside your chosen hours at your daily cap, runs the follow-up sequence, reads replies straight out of your sending mailbox, and stops instantly the moment someone replies. Positive replies are DMed to you, and bounced addresses are never contacted again. Drafts wait for your approval unless you switch on auto-send. (Elite+)

Research:
- Funnel Auditor — score and fix any landing page URL with AI (Pro+)
- Trend Radar — track topics across the web in real time, 10 watch terms (Elite+)
- Competitor Scanner — detailed intel reports on rival businesses (Pro+)
- Competitor Watch — monitor competitor pages for live content changes; alerts on update (Elite+)

Business:
- Meta Ads — real campaign performance + competitor ad intel (Pro+)
- Shopify Integration — revenue, orders, and product performance dashboard (Pro+)
- Revenue Dashboard — MRR, subscriptions, and charges from Stripe (Pro+)
- Company DNA — business memory; give every AI tool context about your company (Pro+)
- Analytics — GA4, Google Search Console, and YouTube in one place (Pro+)

Automation:
- Workflows — multi-step AI automation builder; triggers, logic, AI nodes, Discord/Slack/Email/Notion/HTTP actions (Elite+)

Community:
- Member Directory — browse all Fortune Fortress members
- Mastermind Pods — small accountability circles for Apex members
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
- /matchmake — find Fortune Fortress members worth connecting with
- /ticket — raise a support ticket

PRICING
- Upgrade or subscribe: https://fortify-io.com/pricing`;
