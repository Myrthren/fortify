const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');
const { responseError } = load('lib/response-error.ts');

test('plain-text validation response is read once without a body-stream exception', async () => {
  const response = new Response('Need at least 20 chars describing the prospect', { status: 400 });
  assert.equal(await responseError(response), 'Need at least 20 chars describing the prospect');
  assert.equal(response.bodyUsed, true);
});
test('JSON limit errors remain useful', async () => {
  assert.equal(await responseError(new Response(JSON.stringify({ error: 'Monthly limit reached' }), { status: 429 })), 'Monthly limit reached');
});
test('expired sessions get a clear recovery instruction', async () => {
  assert.match(await responseError(new Response('Unauthorized', { status: 401 })), /Sign in again/);
});
test('provider errors and proxy HTML are not exposed to the customer', async () => {
  assert.equal(await responseError(new Response('Generation failed: confidential provider diagnostics', { status: 500 })), 'Generation is temporarily unavailable (HTTP 500). Please try again later.');
  assert.equal(await responseError(new Response('<html>proxy diagnostics</html>', { status: 403 })), 'Generation failed (HTTP 403). Please try again.');
});
