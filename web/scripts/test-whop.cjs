const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

// Exercise real TS modules with isolated in-memory external services.
function load(path, mocks, env, fetch) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: (name) => name in mocks ? mocks[name] : require(name),
    process: { env }, Buffer, Headers, URL, URLSearchParams, AbortSignal, Date,
    fetch, console: { log() {}, error() {} },
  }, { filename: path });
  return exports;
}

function fixture({ tier = 'FREE', provider, memberships = [], linked = true } = {}) {
  const env = { WHOP_PLAN_PRO: 'plan_pro', WHOP_PLAN_ELITE: 'plan_elite', WHOP_PLAN_APEX: 'plan_apex', WHOP_APP_API_KEY: 'test', WHOP_WEBHOOK_SECRET: 'ws_test' };
  const state = { id: 'u1', tier, discordId: 'd1', whopUserId: linked ? 'w1' : null,
    subscription: provider ? { provider, tier, status: 'ACTIVE', cancelledAt: null } : null };
  const roles = [];
  const user = {
    findUnique: async () => structuredClone(state),
    findUniqueOrThrow: async () => structuredClone(state),
    update: async ({ data }) => { Object.assign(state, data); return state; },
  };
  const subscription = {
    upsert: async ({ create, update }) => { state.subscription = { ...(state.subscription || create), ...update }; },
    update: async ({ data }) => { Object.assign(state.subscription, data); },
  };
  const db = { user, subscription, $transaction: async (fn) => fn({ user, subscription }) };
  const mocks = { '@/lib/db': { db }, '@/lib/discord': { syncTierRole: async (...args) => roles.push(args) } };
  let response = { data: memberships };
  let failed = false;
  const api = load('lib/whop.ts', mocks, env, async () => ({ ok: !failed, status: failed ? 503 : 200, json: async () => response, text: async () => 'unavailable' }));
  return { api, state, roles, mocks, env, response: (value) => { response = value; }, fail: () => { failed = true; } };
}
const member = (tier) => ({ id: `mem_${tier}`, plan: `plan_${tier}` });

for (const [before, after] of [['FREE', 'PRO'], ['PRO', 'APEX'], ['APEX', 'PRO']]) {
  test(`Whop ${before} to ${after} reconciles exact tier and subscription`, async () => {
    const f = fixture({ tier: before, provider: before === 'FREE' ? undefined : 'whop', memberships: [member(after.toLowerCase())] });
    await f.api.syncWhopTier('u1', 'w1');
    assert.equal(f.state.tier, after);
    assert.equal(f.state.subscription.tier, after);
    assert.equal(f.roles[0][1], after);
  });
}
test('expiry revokes access; repeated reconciliation repairs Discord roles', async () => {
  const f = fixture({ tier: 'APEX', provider: 'whop' });
  assert.equal((await f.api.syncWhopTier('u1', 'w1')).revoked, true);
  assert.equal(f.state.tier, 'FREE');
  assert.equal(f.state.subscription.status, 'CANCELLED');
  assert.equal((await f.api.syncWhopTier('u1', 'w1')).revoked, false);
  assert.equal(f.roles.length, 2);
});
test('highest of multiple memberships is used', async () => {
  const f = fixture({ memberships: [member('pro'), member('apex'), member('elite')] });
  await f.api.syncWhopTier('u1', 'w1');
  assert.equal(f.state.tier, 'APEX');
});
test('PayPal ownership survives both higher Whop membership and Whop expiry', async () => {
  for (const memberships of [[member('apex')], []]) {
    const f = fixture({ tier: 'ELITE', provider: 'paypal', memberships });
    await f.api.syncWhopTier('u1', 'w1');
    assert.equal(f.state.tier, 'ELITE');
    assert.equal(f.state.subscription.provider, 'paypal');
    assert.equal(f.state.subscription.status, 'ACTIVE');
    assert.equal(f.roles.length, 0);
  }
});
test('stale lookup cannot re-grant access to a disconnected identity', async () => {
  const f = fixture({ memberships: [member('apex')], linked: false });
  await f.api.syncWhopTier('u1', 'w1');
  assert.equal(f.state.tier, 'FREE');
  assert.equal(f.state.subscription, null);
});
test('API failure, missing configuration, malformed or partial data preserve access', async () => {
  for (const change of [f => f.fail(), f => delete f.env.WHOP_PLAN_APEX,
    f => f.response({}), f => f.response({ data: [], pagination: { next_page: 2 } }),
    f => f.response({ data: [], pagination: { total_pages: 2, current_page: 1 } })]) {
    const f = fixture({ tier: 'APEX', provider: 'whop' }); change(f);
    await assert.rejects(f.api.syncWhopTier('u1', 'w1'));
    assert.equal(f.state.tier, 'APEX');
    assert.equal(f.state.subscription.status, 'ACTIVE');
  }
});
test('unknown plans never grant a paid tier', async () => {
  const f = fixture({ memberships: [{ id: 'other', plan: 'unknown' }] });
  await f.api.syncWhopTier('u1', 'w1');
  assert.equal(f.state.tier, 'FREE');
  assert.equal(f.state.subscription, null);
});
test('webhook signatures reject tampering and stale deliveries', () => {
  const f = fixture(); const body = '{"type":"membership.activated"}';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', f.env.WHOP_WEBHOOK_SECRET).update(`evt1.${timestamp}.${body}`).digest('base64');
  const headers = new Headers({ 'webhook-id': 'evt1', 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` });
  assert.equal(f.api.verifyWebhook(headers, body), true);
  assert.equal(f.api.verifyWebhook(headers, body + ' '), false);
  headers.set('webhook-timestamp', '1');
  assert.equal(f.api.verifyWebhook(headers, body), false);
});
test('disconnect removes Whop access and preserves PayPal access', async () => {
  for (const provider of ['whop', 'paypal']) {
    const f = fixture({ tier: 'APEX', provider });
    const route = load('app/api/whop/disconnect/route.ts', {
      ...f.mocks, '@/auth': { auth: async () => ({ user: { id: 'u1' } }) },
      'next/server': { NextResponse: { json: (value) => value } },
    }, f.env);
    assert.equal((await route.POST()).ok, true);
    assert.equal(f.state.whopUserId, null);
    assert.equal(f.state.tier, provider === 'whop' ? 'FREE' : 'APEX');
    assert.equal(f.state.subscription.status, provider === 'whop' ? 'CANCELLED' : 'ACTIVE');
  }
});
test('checkout URL validation preserves exact tracking query and rejects other destinations', () => {
  const { whopUrl } = load('lib/whop-checkout.ts', {}, {});
  const url = 'https://whop.com/checkout/plan_test?tracking=original%2Bvalue';
  assert.equal(whopUrl(url), url);
  for (const invalid of ['https://whop.com.evil.test/', 'javascript:alert(1)', 'http://whop.com/', 'https://name@whop.com/', undefined]) assert.equal(whopUrl(invalid), null);
});

test('reconnect restores a disconnected but still-valid membership', async () => {
  const f = fixture({ tier: 'FREE', provider: 'whop', linked: false, memberships: [member('elite')] });
  f.state.subscription.status = 'CANCELLED';
  f.state.whopUserId = 'w1';
  await f.api.syncWhopTier('u1', 'w1');
  assert.equal(f.state.tier, 'ELITE');
  assert.equal(f.state.subscription.status, 'ACTIVE');
  assert.equal(f.state.subscription.cancelledAt, null);
});
test('cron requires its secret, traverses pages and reports per-user failures', async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({ id: String(i), whopUserId: `w${i}` }));
  const seen = [];
  class NextResponse {
    constructor(body, { status }) { this.status = status; }
    static json(body, options) { return { ...body, status: options.status }; }
  }
  const cron = load('app/api/cron/whop-reconcile/route.ts', {
    'next/server': { NextResponse },
    '@/lib/db': { db: { user: { findMany: async ({ cursor, take }) => {
      const start = cursor ? rows.findIndex(r => r.id === cursor.id) + 1 : 0;
      return rows.slice(start, start + take);
    } } } },
    '@/lib/whop': { syncWhopTier: async (id) => { seen.push(id); if (id === '1') throw new Error('Whop unavailable'); } },
  }, { CRON_SECRET: 'test-secret' });
  assert.equal((await cron.POST({ headers: new Headers() })).status, 401);
  assert.equal(seen.length, 0);
  const result = await cron.POST({ headers: new Headers({ 'x-cron-secret': 'test-secret' }) });
  assert.equal(result.status, 503);
  assert.equal(result.checked, 50);
  assert.equal(result.failed, 1);
  assert.equal(new Set(seen).size, 51);
});
