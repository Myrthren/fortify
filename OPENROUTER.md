# OpenRouter and shared weekly Claude allowances

The web app and Discord bot use one OpenRouter integration for AI text and image understanding. Existing `claude().messages.create(...)` call sites remain compatible, but direct Anthropic and Groq credentials no longer select the provider. Image generation/editing still uses its dedicated OpenAI image API; search, scraping, payments and other non-model APIs retain their own integrations.

## Included models and allowances

| Plan | Included Claude allowance per week |
| --- | ---: |
| Free | £0; alternative models |
| Pro | £5 |
| Elite | £20 |
| Apex | £50 |

Weeks start Monday at 00:00 UTC. A member's website, Discord, text tools, image understanding, scheduled reports, lead packs, outbound analysis/drafts/reply classification and workflow AI all share the same ledger. Existing tool access, tool-credit charges, capacity limits and anti-abuse request limits still apply.

Standard requests use `anthropic/claude-sonnet-5.5`. Existing premium/Opus requests use `anthropic/claude-opus-5.5`. The defaults are configurable. A request that cannot reserve enough of the remaining included allowance uses a compatible alternative. Free members do not reserve Claude calls. Availability failures may also use an alternative; refusals, invalid prompts and cancellations do not cause a second model attempt.

The default alternate pool is `minimax/minimax-m2.5`, `moonshotai/kimi-k2.5` and `qwen/qwen3.5-397b-a17b`. Each request selects one configured compatible model at random. Tool continuations retain a selected alternate. The live OpenRouter catalogue determines tool, image and context compatibility; an unsupported attachment is never silently removed. A failed alternative is not followed by an unbounded retry chain. These alternatives still incur provider charges; the Claude allowance does not cap their spend.

The chat shows the actual returned model. Paid accounts keep the input available when their Claude allowance is exhausted. The usage meter shows weekly Claude usage for every paid tier, including Apex. Free chat retains its existing trial limit. Optional legacy daily chat-pack purchases are disabled under the new policy; existing pack records remain untouched and are not consumed by this routing. Review any outstanding balances before production rollout.

## Configure both hosts

Set `OPENROUTER_API_KEY` privately in **both** Netlify's production Functions environment and the Fortify bot's Railway environment. These environments are independent. Never use a `NEXT_PUBLIC_*` variable for a key, and never commit a real value. The same OpenRouter account/key can be used for both; separate keys can also point at the same account. Member allowances are shared through PostgreSQL, independently of which key the host uses.

Other settings, with their defaults, are in both `.env.example` files:

```dotenv
OPENROUTER_CLAUDE_MODEL=anthropic/claude-sonnet-5.5
OPENROUTER_CLAUDE_PREMIUM_MODEL=anthropic/claude-opus-5.5
OPENROUTER_FALLBACK_MODELS=minimax/minimax-m2.5,moonshotai/kimi-k2.5,qwen/qwen3.5-397b-a17b
AI_WEEKLY_CLAUDE_GBP_FREE=0
AI_WEEKLY_CLAUDE_GBP_PRO=5
AI_WEEKLY_CLAUDE_GBP_ELITE=20
AI_WEEKLY_CLAUDE_GBP_APEX=50
```

Keep model/budget configuration aligned on both hosts. The optional `AI_USD_TO_GBP` sets GBP per USD; if omitted, the router fetches current ECB reference rates with a six-hour cache and rejects rates older than seven days. Each request records the rate used. This is a policy conversion of reported OpenRouter costs, not a claim about the user's bank/card exchange rate or fees.

The requested included budgets average approximately £21.67, £86.67 and £216.67 per month. Elite and Apex included Claude costs can exceed their £79 and £199 subscription prices before alternate models, infrastructure, taxes and payment fees. The defaults intentionally preserve the owner's requested amounts.

## Accounting and failure behavior

`AiUsageLedger` stores member ID, week, requested model, included-Claude flag, reserved GBP micro-units, settled cost, USD cost, FX rate and provider generation ID. It stores no prompt content. Both Prisma schemas describe this shared table. Account data export includes these records, and the existing account-anonymisation endpoint explicitly deletes them. Full deletion of a user row also cascades the ledger.

Before a model call, a PostgreSQL transaction advisory lock serializes reservations for the same member/week across both hosts. Tier and account availability are checked inside the transaction. The reservation uses current catalogue pricing, bounded output, conservative text framing and a visual-token allowance. A large request can switch to an alternative while some Claude allowance remains because the full request must fit before it starts.

OpenRouter's returned `usage.cost` settles the reservation before validating the generated content, so a paid but malformed model answer still counts as provider spend. Debit of Fortify tool credits remains independently conditional on usable saved tool output. Missing cost uses the conservative reservation and is marked estimated. Definitive pre-generation HTTP rejections release reservations; timeouts, connection failures and other uncertain outcomes retain them. These holds are visible to owners and count until the week changes; there is no automatic refund of an uncertain external charge.

The reservation reduces concurrent overspend, but changing upstream prices and uncertain provider outcomes mean it is not an exact guarantee of the final OpenRouter invoice. Configure account-level OpenRouter spending controls as well when a hard overall provider cap is required. Actual reported costs, including over-estimate/under-estimate differences, remain recorded.

`/admin/usage` reads the new model ledger and includes held reservations in its labelled totals. A member's owner-only log shows recent requests and retains historical AI-session records separately. Old session totals are not added to the new ledger because free chat also uses the old trial tracker, which would double-count its model calls.

## Release order

1. Save the key/configuration on both hosts without publishing an unfinished release.
2. Deploy the web changes first. The production build runs `scripts/ensure-ai-routing.cjs` after Prisma generation. It applies and verifies the additive `prisma/ai-routing.sql`; failure stops that deployment. Local builds and deploy previews do not write a database. For another deployment environment, apply that SQL to its own database before using AI. Do not run a broad production `db push`.
3. Build/redeploy the bot after the table exists. Both the compiled output and source must contain the new integration. The checked-in Railway startup currently uses source, while `npm start` uses `dist`.
4. With a test member, verify an ordinary Claude reply, an Apex premium request, a tool round and an image-understanding request. Set a test member's plan allowance low in an isolated environment to verify fallback across web and Discord, and confirm both requests appear against the same member/week. Verify a scheduled workflow charges its owner. Confirm actual model access and account credit on OpenRouter.

Offline tests do not prove live keys, provider quality/availability, PostgreSQL locking behavior or the current hosting configuration. No live model requests or production database updates were used while preparing this implementation.

## Checks

From `web/`, run `npm run test:ai-routing` and `npm run test:fallback`, plus the workspace, result-credit, buyer-fix, Advisor and affected workflow checks. Run separate web/bot TypeScript checks and validate both Prisma schemas. The monetary/concurrency unit tests use isolated storage/provider doubles; production validation is a separate step.

Official integration references: [OpenRouter quickstart](https://openrouter.ai/docs/quickstart), [reported usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting), [Claude Sonnet 5.5](https://openrouter.ai/anthropic/claude-sonnet-5.5), [Claude Opus 5.5](https://openrouter.ai/anthropic/claude-opus-5.5), [ECB reference-rate methodology](https://data.ecb.europa.eu/methodology/exchange-rates).
