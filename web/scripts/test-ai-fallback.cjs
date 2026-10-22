const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');
const policy = load('lib/ai-fallback.ts');
const request = { model: 'claude-sonnet-4-6', max_tokens: 400, system: [{ type: 'text', text: 'Approved brand facts and voice.', cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: 'Write a supported draft.' }] };

function adapter(reply = { id: 'completion', model: 'openrouter-model', choices: [{ finish_reason: 'stop', message: { content: 'A supported draft.' } }], usage: { prompt_tokens: 11, completion_tokens: 7 } }) {
  const calls = [];
  const api = load('lib/openrouter.ts', { openai: { default: class { chat = { completions: { create: async params => { calls.push(params); return reply; } } }; } } }, { process: { env: { OPENROUTER_API_KEY: 'inert-key' } } });
  return { ...api, calls };
}
test('OpenRouter adapter preserves cached voice text, token usage and actual model identity', async () => {
  const api = adapter(); const result = await api.openrouterMessage(request);
  assert.match(api.calls[0].messages[0].content, /Approved brand facts and voice/);
  assert.match(api.calls[0].messages[0].content, /served through OpenRouter/);
  assert.equal(api.calls[0].max_tokens, 1424); assert.equal(api.calls[0].reasoning.effort, 'low');
  assert.equal(result.model, 'openrouter-model'); assert.equal(result.usage.input_tokens, 11);
  assert.equal(result.content[0].text, 'A supported draft.');
});
test('unsupported documents are rejected before any OpenRouter request', async () => {
  for (const type of ['document']) {
    const api = adapter();
    await assert.rejects(api.openrouterMessage({ ...request, messages: [{ role: 'user', content: [{ type, source: { data: 'private image' } }] }] }), /not supported/);
    assert.equal(api.calls.length, 0);
  }
});
test('tool rounds preserve call IDs, arguments and tool result messages', async () => {
  const api = adapter({ id: 'completion', choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: 'call-2', function: { name: 'lookup', arguments: '{"topic":"draft"}' } }] } }] });
  const result = await api.openrouterMessage({ ...request, tools: [{ name: 'lookup', input_schema: { type: 'object' } }], messages: [
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
    await assert.rejects(api.openrouterMessage({ ...request, tools: [{ name: 'lookup', input_schema: { type: 'object' } }] }));
  }
  await assert.rejects(adapter({ choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }).openrouterMessage(request));
});
test('plain Hook Generator routes through the same member-aware Claude facade', async () => {
  const calls = [];
  const api = load('lib/openai.ts', { openai: { default: class {} }, '@/lib/claude': {
    CLAUDE_MODELS: { fast: 'anthropic/claude-sonnet-5.5' },
    claude: () => ({ messages: { create: async params => { calls.push(params); return { content: [{ type: 'text', text: 'Hook one\nHook two' }] }; } } }),
  } });
  assert.deepEqual(Array.from(await api.generateHooks('Brand messaging', 2)), ['Hook one', 'Hook two']);
  assert.equal(calls[0].model, 'anthropic/claude-sonnet-5.5');
  assert.match(calls[0].messages[0].content, /Brand messaging/);
});
