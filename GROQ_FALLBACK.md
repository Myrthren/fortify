# Web text-generation fallback

The web app runs on Netlify; the Discord bot runs on Railway. Railway variables
are not inherited by Netlify. Set `GROQ_API_KEY` privately in the Fortify Netlify
project with Functions scope for Production and the intended Deploy Preview
context. Never put the key in git, `netlify.toml`, `NEXT_PUBLIC_*` variables or chat.
Set `GROQ_MODEL` only if overriding the default `openai/gpt-oss-120b`.

For web text calls, Anthropic remains primary. Missing Anthropic configuration,
insufficient provider credit, authentication failure, rate limits, connection
failures and provider outages can use Groq. Invalid input, policy refusals and
cancelled requests do not trigger fallback. The plain Hook Generator likewise
falls back from OpenAI text generation. Provider calls have bounded timeouts
and no automatic SDK retries; a failed fallback is not retried at another
provider. Saved voices and tool messages are preserved, and invalid tool output
fails before execution. Groq is a different model, not Claude; returned metadata
and the fallback system context identify it accurately.

This fallback is text/tool only: image analysis, image attachments and image
generation still require their supported provider. No image is silently removed
to make a text-only request succeed. The Railway bot's existing Groq-first
configuration is unchanged.

After setting variables, create a new deploy so the functions receive them.
Use a preview to verify a hook, an outreach draft, a saved-voice request and a
tool call with Anthropic unavailable. Then inspect the result for factual
support and promote only the reviewed release. Mocked fallback tests do not
prove the live key, model access or provider quota. Run
`cd web && node --test scripts/test-ai-fallback.cjs scripts/test-response-error.cjs`
and `npx tsc --noEmit` before release. No schema migration is needed for the
standalone provider-fallback fix; the wider PR #8 still has the rollout below.


Sources: https://console.groq.com/docs/api-reference and https://docs.netlify.com/build/functions/environment-variables/
