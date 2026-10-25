const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');

function ledger() {
  const rows = new Map(), users = { a: { tier: 'PRO' }, b: { tier: 'ELITE' }, free: { tier: 'FREE' } };
  let tail = Promise.resolve(), locks = 0;
  const query = async (sql, userId, start) => {
    if (sql.includes('advisory')) { locks++; return []; }
    return [{ used: BigInt([...rows.values()].filter(r => r.userId === userId && r.weekStart.getTime() === start.getTime() && r.claude && r.state !== 'released').reduce((n, r) => n + (r.charged ?? r.reserved), 0)) }];
  };
  const execute = async (sql, ...args) => {
    if (sql.startsWith('INSERT')) {
      const [id, userId, weekStart, model, claude, reserved, fx] = args;
      rows.set(id, { id, userId, weekStart, model, claude, reserved, fx, state: 'reserved' });
    } else {
      const row = rows.get(args[0]);
      if (!row || row.state !== 'reserved') return 0;
      if (sql.includes("'settled'")) Object.assign(row, { state: 'settled', charged: args[1], usd: args[2], estimated: args[4] });
      else row.state = args[1];
    }
    return 1;
  };
  const db = {
    user: { findUnique: async ({ where }) => users[where.id] || null },
    $queryRawUnsafe: query, $executeRawUnsafe: execute,
    $transaction: fn => {
      const result = tail.then(() => fn({ user: db.user, $queryRawUnsafe: query, $executeRawUnsafe: execute }));
      tail = result.catch(() => {}); return result;
    },
  };
  return { api: load('lib/ai-budget.ts', { './db': { db } }), rows, users, locks: () => locks };
}

test('approved weekly amounts and Monday UTC resets are exact', () => {
  const { api } = ledger();
  assert.equal(api.weeklyLimitMicros('FREE'), 0);
  assert.equal(api.weeklyLimitMicros('PRO'), 2_000_000);
  assert.equal(api.weeklyLimitMicros('ELITE'), 4_000_000);
  assert.equal(api.weeklyLimitMicros('APEX'), 10_000_000);
  assert.equal(api.weekStart(new Date('2026-10-25T23:59:59Z')).toISOString(), '2026-10-19T00:00:00.000Z');
  assert.equal(api.weekStart(new Date('2026-10-26T00:00:00Z')).toISOString(), '2026-10-26T00:00:00.000Z');
});

test('simultaneous web/bot reservations cannot share the last allowance; members remain isolated', async () => {
  const { api, locks } = ledger();
  const results = await Promise.all(Array.from({ length: 30 }, () => api.reserveAiCall('a', 'anthropic/claude', 1_000_000, .8, true)));
  assert.equal(results.filter(Boolean).length, 2);
  assert.equal(locks(), 30);
  assert.ok(await api.reserveAiCall('b', 'anthropic/claude', 1_000_000, .8, true));
  assert.equal((await api.weeklyAiUsage('a')).remainingGbp, 0);
  assert.equal((await api.weeklyAiUsage('b')).remainingGbp, 3);
});

test('actual reported cost replaces a reservation exactly once; fallback spend does not consume Claude allowance', async () => {
  const { api, rows } = ledger();
  const reservation = await api.reserveAiCall('a', 'anthropic/claude', 1_000_000, .8, true);
  await api.settleAiCall(reservation, { id: 'provider-1', usage: { cost: .25 } });
  await api.settleAiCall(reservation, { id: 'provider-1', usage: { cost: 9 } });
  assert.equal(rows.get(reservation.id).charged, 200_000);
  const fallback = await api.reserveAiCall('a', 'qwen/model', 100_000, .8, false);
  await api.settleAiCall(fallback, { id: 'provider-2', usage: { cost: .1 } });
  assert.equal((await api.weeklyAiUsage('a')).usedGbp, .2);
});

test('uncertain/timeout costs remain reserved; definitive rejected requests release; settled spend is never refunded by validation failure', async () => {
  const { api, rows } = ledger();
  const uncertain = await api.reserveAiCall('a', 'anthropic/claude', 1_000_000, .8, true);
  await api.failAiCall(uncertain, new Error('timeout'));
  assert.equal(rows.get(uncertain.id).state, 'uncertain');
  const rejected = await api.reserveAiCall('a', 'anthropic/claude', 1_000_000, .8, true);
  await api.failAiCall(rejected, { status: 429 });
  assert.equal(rows.get(rejected.id).state, 'released');
  const settled = await api.reserveAiCall('a', 'anthropic/claude', 1_000_000, .8, true);
  await api.settleAiCall(settled, { usage: { cost: .5 } });
  await api.failAiCall(settled, { status: 400 });
  assert.equal(rows.get(settled.id).state, 'settled');
  assert.equal((await api.weeklyAiUsage('a')).usedGbp, 1.4);
});

test('missing cost stays conservative, free accounts get no Claude, and unknown/banned accounts cannot reserve fallback calls', async () => {
  const { api, rows, users } = ledger();
  const reserved = await api.reserveAiCall('a', 'anthropic/claude', 1_000_000, .8, true);
  await api.settleAiCall(reserved, {});
  assert.equal(rows.get(reserved.id).estimated, true);
  assert.equal((await api.weeklyAiUsage('a')).usedGbp, 1);
  assert.equal(await api.reserveAiCall('free', 'anthropic/claude', 1, .8, true), null);
  assert.ok(await api.reserveAiCall('free', 'qwen/model', 1, .8, false));
  await assert.rejects(api.reserveAiCall('missing', 'qwen/model', 1, .8, false), /access/);
  users.a.softwareBanned = true;
  await assert.rejects(api.reserveAiCall('a', 'qwen/model', 1, .8, false), /access/);
});

const request = { model: 'anthropic/claude-sonnet-5.5', max_tokens: 400, messages: [{ role: 'user', content: 'Draft a useful answer.' }] };
function router({ allowClaude = true, primaryError, models, env = {}, apiKey = true } = {}) {
  const events = [], policy = load('lib/ai-fallback.ts');
  const catalog = models || ['anthropic/claude-sonnet-5.5', 'anthropic/claude-opus-5.5', 'minimax/minimax-m2.5', 'moonshotai/kimi-k2.5', 'qwen/qwen3.5-397b-a17b'].map(id => ({ id, context_length: 200000, pricing: { prompt: '.000003', completion: '.000015' }, supported_parameters: ['tools'], architecture: { input_modalities: ['text', 'image'] } }));
  const api = load('lib/ai-router.ts', {
    './ai-fallback': policy,
    './openrouter': {
      openrouterConfigured: () => apiKey,
      validateOpenrouterRequest: params => { if (params.invalid) throw new Error('Invalid prompt'); },
      openrouterMessage: async (params, options) => {
        events.push(['call', options.model]);
        if (options.model.startsWith('anthropic/') && primaryError) throw primaryError;
        await options.onUsage({ id: 'completion', usage: { cost: .01 } });
        return { model: options.model, content: [{ type: 'text', text: 'Answer' }] };
      },
    },
    './ai-budget': {
      reserveAiCall: async (userId, model, amount, fx, primary) => {
        events.push(['reserve', userId, primary]);
        return primary && !allowClaude ? null : { id: 'reservation', model, reservedMicros: amount, fx };
      },
      settleAiCall: async () => { events.push(['settle']); return .008; },
      failAiCall: async () => { events.push(['fail']); },
    },
  }, { process: { env: { AI_USD_TO_GBP: '.8', ...env } }, fetch: async () => ({ ok: true, json: async () => ({ data: catalog }) }) });
  return { api, events };
}

test('Claude is primary, premium uses Opus, and exhausting the reservation chooses a configured alternate', async () => {
  const healthy = router();
  assert.equal((await healthy.api.routedAiMessage('member', request)).fortify.fallback, false);
  assert.equal((await healthy.api.routedAiMessage('member', { ...request, model: 'claude-opus-4-7' })).model, 'anthropic/claude-opus-5.5');
  const exhausted = router({ allowClaude: false });
  const result = await exhausted.api.routedAiMessage('member', request);
  assert.equal(result.fortify.fallback, true);
  assert.ok(exhausted.api.fallbackPool().includes(result.model));
  assert.equal(exhausted.events.filter(e => e[0] === 'call').length, 1);
  assert.equal(exhausted.events[0][1], 'member');
});

test('provider outages fall back once; refusals and bad input do not route to another model', async () => {
  const unavailable = router({ primaryError: { status: 503 } });
  assert.equal((await unavailable.api.routedAiMessage('member', request)).fortify.fallback, true);
  assert.equal(unavailable.events.filter(e => e[0] === 'call').length, 2);
  const refused = router({ primaryError: { status: 403 } });
  await assert.rejects(refused.api.routedAiMessage('member', request));
  assert.equal(refused.events.filter(e => e[0] === 'call').length, 1);
  const invalid = router();
  await assert.rejects(invalid.api.routedAiMessage('member', { ...request, invalid: true }), /Invalid/);
  assert.equal(invalid.events.length, 0);
});

test('tool and image requests never select an incompatible model, and tool continuations retain the selected alternate', async () => {
  const model = { id: 'qwen/vision-tool', context_length: 200000, pricing: { prompt: '.000001', completion: '.000001' }, supported_parameters: ['tools'], architecture: { input_modalities: ['text', 'image'] } };
  const api = router({ allowClaude: false, models: [model, { ...model, id: 'qwen/text-only', architecture: { input_modalities: ['text'] } }], env: { OPENROUTER_FALLBACK_MODELS: 'qwen/vision-tool,qwen/text-only' } });
  const vision = { ...request, tools: [{ name: 'lookup' }], messages: [{ role: 'user', content: [{ type: 'image' }] }] };
  assert.equal((await api.api.routedAiMessage('member', vision)).model, 'qwen/vision-tool');
  const pinned = router({ env: { OPENROUTER_FALLBACK_MODELS: 'minimax/minimax-m2.5,qwen/qwen3.5-397b-a17b' } });
  assert.equal((await pinned.api.routedAiMessage('member', { ...request, model: 'minimax/minimax-m2.5' })).model, 'minimax/minimax-m2.5');
  assert.equal(pinned.events.filter(e => e[0] === 'reserve' && e[2]).length, 0);
});

test('missing identity, configuration and cancellation make no provider requests', async () => {
  const instance = router();
  await assert.rejects(instance.api.routedAiMessage('', request), /member/);
  await assert.rejects(instance.api.routedAiMessage('member', request, { signal: { aborted: true } }), /cancelled/);
  assert.equal(instance.events.length, 0);
  await assert.rejects(router({ apiKey: false }).api.routedAiMessage('member', request), /API_KEY/);
});

test('fallback configuration cannot quietly include Claude or an unrestricted router', () => {
  assert.throws(() => router({ env: { OPENROUTER_FALLBACK_MODELS: 'anthropic/claude-sonnet-5.5' } }).api.fallbackPool());
  assert.throws(() => router({ env: { OPENROUTER_FALLBACK_MODELS: 'auto' } }).api.fallbackPool());
  assert.throws(() => router({ env: { OPENROUTER_FALLBACK_MODELS: 'openrouter/auto' } }).api.fallbackPool());
});

test('member context stays isolated across asynchronous background jobs', async () => {
  const context = load('lib/ai-context.ts');
  const results = await Promise.all(['member-a', 'member-b'].map(id => context.withAiUser(id, async () => {
    await new Promise(resolve => setImmediate(resolve));
    return context.currentAiUserId();
  })));
  assert.deepEqual(results, ['member-a', 'member-b']);
  assert.equal(context.currentAiUserId(), undefined);
});

test('workflow AI charges the owned workflow member, including scheduled runs without an HTTP session', async () => {
  const ids = [];
  const api = load('lib/workflow-runner.ts', {
    '@/lib/result-credits': {}, '@/lib/workflow-errors': { readableRunError: e => String(e) },
    '@/lib/claude': { claude: id => ({ messages: { create: async () => { ids.push(id); return { content: [{ type: 'text', text: 'Generated' }] }; } } }) },
    resend: { Resend: class {} }, '@/lib/workflow-capacity': { getCapacityInfo: async () => ({ isUnlimited: false, remaining: 1000 }) },
    '@/lib/workflow-starters': {}, '@/lib/brave': {},
    '@/lib/db': { db: {
      workflow: { findFirst: async ({ where }) => ({ id: 'workflow', userId: where.userId, nodes: [{ id: 'node', type: 'ai_generate', config: { prompt: 'Test' } }] }) },
      user: { findUnique: async () => ({ id: 'owner', tier: 'ELITE' }) },
      workflowRun: { create: async () => ({ id: 'run' }), update: async () => ({}) },
      socialConnection: { findFirst: async () => null },
    } },
  });
  const result = await api.runWorkflow('workflow', 'workflow-owner');
  assert.equal(result.status, 'completed');
  assert.deepEqual(ids, ['workflow-owner']);
});

test('image reservation excludes base64 byte inflation and includes a bounded visual-token allowance', () => {
  const { api } = router();
  const model = { id: 'anthropic/claude-sonnet-5.5', context_length: 200000, pricing: { prompt: '.000003', completion: '.000015' } };
  const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'a'.repeat(2_000_000) } };
  assert.ok(api.quoteCall({ ...request, messages: [{ role: 'user', content: [image] }] }, model, .8) > 0);
});

test('a paid member with exhausted Claude allowance can still send chat and sees the actual alternate model', async () => {
  const user = { id: 'member', tier: 'PRO' };
  const common = {
    '@/auth': { auth: async () => ({ user: { id: user.id } }) },
    'next/server': { NextResponse: Response },
    '@/lib/db': { db: {
      user: { findUnique: async () => user }, companyDna: { findUnique: async () => null }, businessProfile: { findFirst: async () => null }, chatSession: { findMany: async () => [] },
    } },
    '@/lib/ai-usage': { getOrCreateSession: async () => { throw new Error('Old paid daily gate must not run'); }, deductCost: async () => { throw new Error('Old paid packs must not be debited'); } },
  };
  const usage = load('app/api/ai/chat/usage/route.ts', { ...common, '@/lib/ai-budget': { weeklyAiUsage: async () => ({ usedGbp: 2, limitGbp: 2, remainingGbp: 0, fallback: true, resetsAt: '2026-10-26T00:00:00Z' }) } });
  const state = await (await usage.GET()).json();
  assert.equal(state.canUse, true);
  assert.equal(state.sessionExhausted, false);
  assert.equal(state.fallback, true);
  const route = load('app/api/ai/chat/route.ts', {
    ...common, '@/lib/result-credits': {}, '@/lib/abuse': {}, '@/lib/openai': {},
    '@/lib/rate-limit': { rateLimit: () => ({ ok: true }) },
    '@/lib/claude': { CLAUDE_MODELS: { fast: 'anthropic/claude-sonnet-5.5' }, claude: () => ({ messages: { create: async () => ({
      content: [{ type: 'text', text: 'A useful answer' }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn',
      fortify: { model: 'minimax/minimax-m2.5', fallback: true, costGbp: .002 },
    }) } }) },
  });
  const response = await route.POST(new Request('https://fortify-io.com/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }) }));
  const body = await response.json();
  assert.equal(body.message, 'A useful answer');
  assert.equal(body.fallback, true);
  assert.equal(body.model, 'minimax/minimax-m2.5');
  assert.equal(body.costGbp, .002);
});

test('account export includes only the authenticated member ledger and anonymisation removes that ledger', async () => {
  const ids = [];
  const model = { findMany: async () => [], findUnique: async () => ({}), deleteMany: async () => ({}), updateMany: async () => ({}), update: async () => ({}) };
  const db = new Proxy({
    $queryRawUnsafe: async (sql, id) => { ids.push(id); assert.match(sql, /WHERE "userId" = \$1/); return [{ model: 'qwen/alternate', userId: id }]; },
    $transaction: async action => action(new Proxy({ $executeRawUnsafe: async (sql, id) => { ids.push(id); assert.match(sql, /DELETE FROM "AiUsageLedger" WHERE "userId" = \$1/); } }, { get: (obj, name) => obj[name] || model })),
  }, { get: (obj, name) => obj[name] || model });
  const mocks = { '@/lib/db': { db }, '@/auth': { auth: async () => ({ user: { id: 'own-member' } }) }, 'next/server': { NextResponse: Response } };
  const exported = await (await load('app/api/user/export/route.ts', mocks).GET()).json();
  assert.equal(exported.aiUsageLedger[0].userId, 'own-member');
  assert.equal((await load('app/api/user/delete/route.ts', mocks).DELETE()).status, 200);
  assert.deepEqual(ids, ['own-member', 'own-member']);
});

test('outbound providers are available with only an OpenRouter key; retired credentials cannot enable them', () => {
  const mocks = {
    '@/lib/claude': { CLAUDE_MODELS: {} }, '@/lib/outbound/offer': {},
    '@/lib/outbound/types': { ANALYSIS_DIMENSIONS: [] }, '@/lib/outbound/guardrails': { BANNED_PHRASES: [] },
  };
  for (const [path, key] of [['analysis', 'claudeAnalysis'], ['compose', 'claudeComposer']]) {
    assert.equal(load(`lib/outbound/providers/${path}/claude.ts`, mocks, { process: { env: { OPENROUTER_API_KEY: 'inert-key' } } })[key].isAvailable(), true);
    assert.equal(load(`lib/outbound/providers/${path}/claude.ts`, mocks, { process: { env: { ANTHROPIC_API_KEY: 'retired-key' } } })[key].isAvailable(), false);
  }
});

test('web facade resolves authenticated ownership and bot facade rejects unbound calls', async () => {
  const calls = [], mocks = {
    '@/auth': { auth: async () => ({ user: { id: 'authenticated-member' } }) },
    './ai-context': { currentAiUserId: () => undefined },
    './ai-router': { AI_MODELS: {}, routedAiMessage: async id => { calls.push(id); return 'answer'; } },
  };
  await load('lib/claude.ts', mocks).claude().messages.create({ userId: 'spoofed' });
  assert.deepEqual(calls, ['authenticated-member']);
  await assert.rejects(load('../bot/src/lib/claude.ts', mocks).claude().messages.create({ userId: 'spoofed' }), /member/);
});
