# OpenRouter and shared weekly Claude allowances

The web app and Discord bot use one OpenRouter integration for AI text and image understanding. Existing `claude().messages.create(...)` call sites remain compatible, but direct Anthropic and Groq credentials no longer select the provider. Image generation/editing still uses its dedicated OpenAI image API; search, scraping, payments and other non-model APIs retain their own integrations.

## Included models and allowances

| Plan | Included Claude allowance per week |
| --- | ---: |
| Free | £0; alternative models |
| Pro | £2 |
| Elite | £4 |
| Apex | £10 |

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
AI_WEEKLY_CLAUDE_GBP_PRO=2
AI_WEEKLY_CLAUDE_GBP_ELITE=4
AI_WEEKLY_CLAUDE_GBP_APEX=10
```

Keep model/budget configuration aligned on both hosts. Existing `AI_WEEKLY_CLAUDE_GBP_*` variables override these defaults: replace any older 5/20/50 values with 2/4/10 before release. The optional `AI_USD_TO_GBP` sets GBP per USD; if omitted, the router fetches current ECB reference rates with a six-hour cache and rejects rates older than seven days. Each request records the rate used. This is a policy conversion of reported OpenRouter costs, not a claim about the user's bank/card exchange rate or fees.

### Allowance economics

These owner-approved allowances allocate about 22% of Elite/Apex subscription revenue to included Claude usage at full utilisation. Monthly equivalents use 52 weeks / 12 months; individual months can contain five weekly resets.

| Plan | Monthly subscription | Weekly Claude allowance | Average monthly Claude budget | Revenue left after Claude only |
| --- | ---: | ---: | ---: | ---: |
| Pro | £29 | £2 | £8.67 | £20.33 (70.1%) |
| Elite | £79 | £4 | £17.33 | £61.67 (78.1%) |
| Apex | £199 | £10 | £43.33 | £155.67 (78.2%) |

The remainder must cover alternate models, image generation, hosting, other APIs, payment/platform fees, affiliate commissions, taxes where applicable, support and profit. It is not net profit or a guaranteed margin. For example, a 30% affiliate commission on the listed subscription price would leave approximately £37.97 for Elite and £95.97 for Apex after Claude and that commission, before other costs. In a five-reset month, Claude alone would cost up to £20 for Elite or £50 for Apex. All members still share one allowance across every AI text/vision surface, and paid chat still continues on an alternative model after Claude runs out. Alternative model spend is metered but not capped by these Claude budgets, so review total per-member provider spend against collected revenue before increasing allowances.

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

For an opt-in hosted release check, set `FORTIFY_VERIFY_AI_RELEASE=true` in the production build environment for one deployment, then remove it. `scripts/verify-ai-release.cjs` validates the private key, blocks unresolved legacy pack balances, verifies the 2/4/10 limits and real cross-web/bot PostgreSQL reservations, and makes small synthetic Claude, premium, alternative, tool-round and image-understanding requests. It uses temporary test members and removes those members and their test ledger records afterward. It prints only check labels/model IDs; provider/database errors and secrets are not logged. Publication stops if a check fails. The normal build skips this check when the flag is absent.

## Checks

From `web/`, run `npm run test:ai-routing` and `npm run test:fallback`, plus the workspace, result-credit, buyer-fix, Advisor and affected workflow checks. Run separate web/bot TypeScript checks and validate both Prisma schemas. The monetary/concurrency unit tests use isolated storage/provider doubles; production validation is a separate step.

Official integration references: [OpenRouter quickstart](https://openrouter.ai/docs/quickstart), [reported usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting), [Claude Sonnet 5.5](https://openrouter.ai/anthropic/claude-sonnet-5.5), [Claude Opus 5.5](https://openrouter.ai/anthropic/claude-opus-5.5), [ECB reference-rate methodology](https://data.ecb.europa.eu/methodology/exchange-rates).
