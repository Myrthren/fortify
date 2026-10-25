const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');

for (const path of ['lib/openrouter.ts', '../bot/src/lib/openrouter.ts']) {
  test(`${path}: connects only to OpenRouter with server configuration and supports model overrides`, async () => {
    const constructors = [], requests = [];
    const api = load(path, { openai: { default: class {
      constructor(options) { constructors.push(options); }
      chat = { completions: { create: async (body, options) => {
        requests.push({ body, options });
        return { id: 'result', model: 'vendor/resolved-model', choices: [{ finish_reason: 'stop', message: { content: 'Result' } }] };
      } } };
    } } }, { process: { env: { OPENROUTER_API_KEY: 'inert-test-key', OPENROUTER_MODEL: 'vendor/selected-model', GROQ_API_KEY: 'unused-old-key' } } });
    const signal = new AbortController().signal;
    const result = await api.openrouterMessage({ max_tokens: 250, messages: [{ role: 'user', content: 'Hello' }] }, { signal });
    assert.equal(constructors[0].baseURL, 'https://openrouter.ai/api/v1');
    assert.equal(constructors[0].apiKey, 'inert-test-key');
    assert.equal(constructors[0].maxRetries, 0);
    assert.equal(requests[0].body.model, 'vendor/selected-model');
    assert.equal(requests[0].body.max_tokens, 250);
    assert.equal(requests[0].options.signal, signal);
    assert.equal(result.model, 'vendor/resolved-model');
  });

  test(`${path}: an old Groq key cannot enable the new provider`, async () => {
    let calls = 0;
    const api = load(path, { openai: { default: class { constructor() { calls++; } } } }, { process: { env: { GROQ_API_KEY: 'inert-old-key' } } });
    assert.equal(api.openrouterConfigured(), false);
    await assert.rejects(api.openrouterMessage({ messages: [{ role: 'user', content: 'Hello' }] }), /not configured/);
    assert.equal(calls, 0);
  });
}
