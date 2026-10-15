const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');
const policy = load('lib/ai-fallback.ts');
const request = { model: 'claude-sonnet-4-6', max_tokens: 400, system: [{ type: 'text', text: 'Approved brand facts and voice.', cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: 'Write a supported draft.' }] };

function service({ env = { ANTHROPIC_API_KEY: 'inert-primary', GROQ_API_KEY: 'inert-fallback' }, primary = async () => ({ content: [{ type: 'text', text: 'primary' }] }), fallback = async () => ({ content: [{ type: 'text', text: 'fallback' }] }) } = {}) {
  let primaryCalls = 0, fallbackCalls = 0;
  const mod = load('lib/claude.ts', {
    '@anthropic-ai/sdk': { default: class { messages = { create: async (...args) => { primaryCalls++; return primary(...args); } }; } },
    '@/lib/ai-fallback': policy,
    '@/lib/groq': { groqConfigured: () => Boolean(env.GROQ_API_KEY), groqMessage: async (...args) => { fallbackCalls++; return fallback(...args); } },
  }, { process: { env } });
  return { mod, counts: () => [primaryCalls, fallbackCalls] };
}
test('healthy Anthropic is used first and preserves the request', async () => {
  const api = service({ primary: async params => { assert.equal(params, request); return 'primary'; } });
  assert.equal(await api.mod.claude().messages.create(request), 'primary');
  assert.deepEqual(api.counts(), [1, 0]);
});
test('the observed low-credit 400 falls back once, retaining context', async () => {
  const api = service({ primary: async () => { throw { status: 400, message: 'Your credit balance is too low to access the Anthropic API.' }; }, fallback: async params => { assert.equal(params, request); return 'groq'; } });
  assert.equal(await api.mod.claude().messages.create(request), 'groq');
  assert.deepEqual(api.counts(), [1, 1]);
});
test('availability errors qualify but malformed input and policy refusals do not', () => {
  for (const status of [401, 402, 408, 429, 500, 503, 529]) assert.equal(policy.canFallback({ status }), true);
  assert.equal(policy.canFallback({ name: 'APIConnectionTimeoutError' }), true);
  for (const error of [{ status: 400, message: 'context too long' }, { status: 403, message: 'policy refusal' }, { status: 404 }, new Error('application bug')]) assert.equal(policy.canFallback(error), false);
});
test('validation failures are not silently routed to Groq', async () => {
  const api = service({ primary: async () => { throw { status: 400, message: 'Invalid prompt' }; } });
  await assert.rejects(api.mod.claude().messages.create(request)); assert.deepEqual(api.counts(), [1, 0]);
});
test('Groq works when the Anthropic key is absent', async () => {
  const api = service({ env: { GROQ_API_KEY: 'inert-fallback' } });
  await api.mod.claude().messages.create(request); assert.deepEqual(api.counts(), [0, 1]);
});
test('missing fallback preserves the primary failure and a failed fallback does not loop', async () => {
  const primary = async () => { throw { status: 429 }; };
  const absent = service({ env: { ANTHROPIC_API_KEY: 'inert-primary' }, primary });
  await assert.rejects(absent.mod.claude().messages.create(request)); assert.deepEqual(absent.counts(), [1, 0]);
  const failed = service({ primary, fallback: async () => { throw new Error('Groq unavailable'); } });
  await assert.rejects(failed.mod.claude().messages.create(request), /Groq unavailable/); assert.deepEqual(failed.counts(), [1, 1]);
});
test('cancellation never triggers a second provider', async () => {
  const api = service();
  await assert.rejects(api.mod.claude().messages.create(request, { signal: { aborted: true } }), /cancelled/); assert.deepEqual(api.counts(), [0, 0]);
});

function adapter(reply = { id: 'completion', model: 'groq-model', choices: [{ finish_reason: 'stop', message: { content: 'A supported draft.' } }], usage: { prompt_tokens: 11, completion_tokens: 7 } }) {
  const calls = [];
  const api = load('lib/groq.ts', { openai: { default: class { chat = { completions: { create: async params => { calls.push(params); return reply; } } }; } } }, { process: { env: { GROQ_API_KEY: 'inert-key' } } });
  return { ...api, calls };
}
test('Groq adapter preserves cached voice text, token usage and actual model identity', async () => {
  const api = adapter(); const result = await api.groqMessage(request);
  assert.match(api.calls[0].messages[0].content, /Approved brand facts and voice/);
  assert.match(api.calls[0].messages[0].content, /served by Groq/);
  assert.equal(api.calls[0].max_completion_tokens, 1424); assert.equal(api.calls[0].reasoning_effort, 'low');
  assert.equal(result.model, 'openai/gpt-oss-120b'); assert.equal(result.usage.input_tokens, 11);
  assert.equal(result.content[0].text, 'A supported draft.');
});
test('image/document content is rejected before a text-only Groq request', async () => {
  for (const type of ['image', 'document']) {
    const api = adapter();
    await assert.rejects(api.groqMessage({ ...request, messages: [{ role: 'user', content: [{ type, source: { data: 'private image' } }] }] }), /not supported/);
    assert.equal(api.calls.length, 0);
  }
});
test('tool rounds preserve call IDs, arguments and tool result messages', async () => {
  const api = adapter({ id: 'completion', choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: 'call-2', function: { name: 'lookup', arguments: '{"topic":"draft"}' } }] } }] });
  const result = await api.groqMessage({ ...request, tools: [{ name: 'lookup', input_schema: { type: 'object' } }], messages: [
    { role: 'assistant', content: [{ type: 'tool_use', id: 'call-1', name: 'lookup', input: { topic: 'facts' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call-1', content: [{ type: 'text', text: 'Verified facts' }] }] },
  ] });
  assert.equal(api.calls[0].messages[1].tool_calls[0].id, 'call-1');
  assert.equal(api.calls[0].messages[2].role, 'tool'); assert.equal(api.calls[0].messages[2].tool_call_id, 'call-1');
  assert.equal(result.stop_reason, 'tool_use'); assert.equal(result.content[0].input.topic, 'draft');
});
test('unknown tools, malformed arguments, refusals and empty output fail closed', async () => {
  for (const msg of [{ content: null }, { content: null, tool_calls: [{ id: 'x', function: { name: 'delete_everything', arguments: '{}' } }] }, { content: null, tool_calls: [{ id: 'x', function: { name: 'lookup', arguments: 'invalid-json' } }] }]) {
    const api = adapter({ id: 'completion', choices: [{ finish_reason: 'stop', message: msg }] });
    await assert.rejects(api.groqMessage({ ...request, tools: [{ name: 'lookup', input_schema: { type: 'object' } }] }));
  }
  await assert.rejects(adapter({ choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }).groqMessage(request));
});
test('plain Hook Generator uses Groq when its OpenAI provider is unavailable', async () => {
  let calls = 0;
  const api = load('lib/openai.ts', { openai: { default: class { chat = { completions: { create: async () => { throw { status: 429 }; } } }; } }, '@/lib/ai-fallback': policy, '@/lib/groq': { groqConfigured: () => true, groqMessage: async params => { calls++; assert.match(params.messages[0].content, /Topic: Brand messaging/); return { content: [{ type: 'text', text: 'Hook one\nHook two' }] }; } } }, { process: { env: { OPENAI_API_KEY: 'inert-key' } } });
  assert.deepEqual(Array.from(await api.generateHooks('Brand messaging', 2)), ['Hook one', 'Hook two']); assert.equal(calls, 1);
});
test('without an OpenAI key a failing Groq hook request is attempted only once', async () => {
  let calls = 0;
  const api = load('lib/openai.ts', { openai: { default: class {} }, '@/lib/ai-fallback': policy, '@/lib/groq': { groqConfigured: () => true, groqMessage: async () => { calls++; throw { status: 429 }; } } });
  await assert.rejects(api.generateHooks('Brand messaging')); assert.equal(calls, 1);
});
