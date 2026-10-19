const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');
const core = load('lib/advisor-run.ts');
const challenge = 'How should I improve my outreach conversion?';

function service({ tier = 'APEX', authenticated = true, generate, limited = false } = {}) {
  const rows = new Map(), calls = [], limits = [];
  const db = {
    user: { findUnique: async () => ({ tier }) },
    chatSession: {
      create: async ({ data }) => {
        const row = { id: `session-${rows.size + 1}`, createdAt: new Date(), ...data };
        rows.set(row.id, structuredClone(row)); return structuredClone(row);
      },
      findFirst: async ({ where }) => {
        const row = rows.get(where.id);
        return row?.userId === where.userId ? structuredClone(row) : null;
      },
      updateMany: async ({ where, data }) => {
        const row = rows.get(where.id);
        if (!row || row.userId !== where.userId || JSON.stringify(row.messages) !== JSON.stringify(where.messages.equals)) return { count: 0 };
        rows.set(row.id, { ...row, ...structuredClone(data) }); return { count: 1 };
      },
    },
  };
  const route = load('app/api/ai/advisor/route.ts', {
    'next/server': { NextResponse: class extends Response { static json(data, init) { return Response.json(data, init); } } },
    '@/auth': { auth: async () => authenticated ? { user: { id: 'member-1' } } : null },
    '@/lib/db': { db },
    '@/lib/advisor-run': core,
    '@/lib/advisor': { buildAdvisorContext: async () => 'Verified business facts', advisorSystemPrompt: context => context },
    '@/lib/rate-limit': { rateLimit: (...args) => { limits.push(args); return { ok: !limited, resetMs: Date.now() + 60000 }; }, rateLimitResponse: () => Response.json({ error: 'Rate limited' }, { status: 429 }) },
    '@/lib/claude': { CLAUDE_MODELS: { premium: 'premium-test' }, claude: () => ({ messages: { create: async (params, options) => {
      calls.push({ params, options });
      return generate ? generate(params, options) : { content: [{ type: 'text', text: `## Section ${calls.length}\nSupported advice.` }], stop_reason: 'end_turn' };
    } } }) },
  });
  const post = async body => {
    const response = await route.POST(new Request('https://fortify.test/api/ai/advisor', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }));
    return { status: response.status, data: await response.json().catch(() => ({})) };
  };
  return { post, rows, calls, limits };
}

async function start(api) { return (await api.post({ challenge })).data.session; }

test('new sessions save immediately without a provider call; one session rate-limit charge', async () => {
  const api = service(); const session = await start(api);
  assert.equal(session.completedSections, 0); assert.equal(api.calls.length, 0); assert.equal(api.limits.length, 1);
  assert.equal(api.rows.size, 1); assert.equal(session.messages[0].advisor, undefined);
});

test('older open tabs get a valid title and refresh guidance on rollout', async () => {
  const result = await service().post({ challenge });
  assert.equal(result.data.title, result.data.session.title);
  assert.equal(result.data.sessionId, result.data.session.id);
  assert.match(result.data.response, /Refresh this page/);
});

test('each request writes one section with prior context and bounded provider time', async () => {
  const api = service(); const session = await start(api);
  for (let step = 0; step < 3; step++) {
    const result = await api.post({ sessionId: session.id, step });
    assert.equal(result.status, 200); assert.equal(result.data.session.completedSections, step + 1);
    const call = api.calls[step];
    assert.equal(call.params.max_tokens, 1600); assert.equal(call.options.timeout, 35000);
    assert.ok(call.options.signal instanceof AbortSignal);
    assert.match(call.params.system, /Verified business facts/);
    if (step) assert.match(call.params.messages[1].content, /Section 1/);
  }
  assert.equal(api.rows.size, 1); assert.equal(api.limits.length, 1); assert.equal(api.calls.length, 3);
});

test('replaying a saved section is idempotent and cannot rewrite the challenge', async () => {
  const api = service(); const session = await start(api);
  await api.post({ sessionId: session.id, step: 0 });
  const replay = await api.post({ sessionId: session.id, step: 0, challenge: 'Tampered prompt' });
  assert.equal(replay.status, 200); assert.equal(api.calls.length, 1);
  assert.equal(replay.data.session.messages[0].content, challenge);
});

test('failed and truncated sections keep earlier work and can be resumed', async () => {
  let attempts = 0;
  const api = service({ generate: async () => {
    attempts++;
    if (attempts === 2) throw new Error('Provider unavailable');
    if (attempts === 3) return { content: [{ type: 'text', text: 'Cut off' }], stop_reason: 'max_tokens' };
    return { content: [{ type: 'text', text: `Complete section ${attempts}` }], stop_reason: 'end_turn' };
  } });
  const session = await start(api);
  await api.post({ sessionId: session.id, step: 0 });
  for (let retry = 0; retry < 2; retry++) {
    const failed = await api.post({ sessionId: session.id, step: 1 });
    assert.equal(failed.status, 503); assert.equal(failed.data.session.completedSections, 1);
    assert.match(failed.data.session.messages[1].content, /Complete section 1/);
    assert.equal(core.readAdvisorProgress(api.rows.get(session.id).messages).leaseId, null);
  }
  const resumed = await api.post({ sessionId: session.id, step: 1 });
  assert.equal(resumed.status, 200); assert.equal(resumed.data.session.completedSections, 2);
  assert.equal(core.readAdvisorProgress(api.rows.get(session.id).messages).attempts, 0);
});

test('simultaneous requests make only one provider call', async () => {
  let release, entered;
  const started = new Promise(resolve => entered = resolve);
  const blocked = new Promise(resolve => release = resolve);
  const api = service({ generate: async () => { entered(); await blocked; return { content: [{ type: 'text', text: 'Saved section' }], stop_reason: 'end_turn' }; } });
  const session = await start(api);
  const first = api.post({ sessionId: session.id, step: 0 });
  await started;
  const second = await api.post({ sessionId: session.id, step: 0 });
  assert.equal(second.status, 409); assert.equal(api.calls.length, 1);
  release(); assert.equal((await first).status, 200);
});

test('a killed request can be retried after its lease expires', async () => {
  const api = service(); const session = await start(api);
  const row = api.rows.get(session.id);
  row.messages[0].advisor.leaseId = 'killed-request'; row.messages[0].advisor.leaseUntil = Date.now() - 1;
  const result = await api.post({ sessionId: session.id, step: 0 });
  assert.equal(result.status, 200); assert.equal(result.data.session.completedSections, 1);
});

test('four failed attempts cap spend on a single section', async () => {
  const api = service({ generate: async () => { throw new Error('Unavailable'); } });
  const session = await start(api);
  for (let n = 0; n < 4; n++) assert.equal((await api.post({ sessionId: session.id, step: 0 })).status, 503);
  assert.equal((await api.post({ sessionId: session.id, step: 0 })).status, 429); assert.equal(api.calls.length, 4);
});

test('authentication, tier and ownership checks apply to continuation requests', async () => {
  assert.equal((await service({ authenticated: false }).post({ sessionId: 'x', step: 0 })).status, 401);
  assert.equal((await service({ tier: 'ELITE' }).post({ sessionId: 'x', step: 0 })).status, 403);
  const api = service(); const session = await start(api); api.rows.get(session.id).userId = 'someone-else';
  assert.equal((await api.post({ sessionId: session.id, step: 0 })).status, 404); assert.equal(api.calls.length, 0);
});

test('invalid inputs and skipped sections fail before a provider call', async () => {
  const api = service();
  for (const body of [null, [], { challenge: 123 }, { challenge: 'short' }, { challenge: 'x'.repeat(4001) }, { sessionId: 123, step: 0 }, { sessionId: 'x', step: 0.5 }]) {
    assert.equal((await api.post(body)).status, 400);
  }
  const session = await start(api);
  assert.equal((await api.post({ sessionId: session.id, step: 2 })).status, 409); assert.equal(api.calls.length, 0);
  assert.equal((await service({ limited: true }).post({ challenge })).status, 429);
});

test('historical sessions and Growth Briefs stay readable and cannot be resumed', async () => {
  const api = service(); const session = await start(api); const row = api.rows.get(session.id);
  row.messages = [{ role: 'user', content: challenge }, { role: 'assistant', content: 'Original brief' }];
  const view = core.advisorSessionView(row);
  assert.equal(view.completedSections, null); assert.equal(view.messages[1].content, 'Original brief');
  assert.equal((await api.post({ sessionId: session.id, step: 0 })).status, 400);
});

test('browser orchestration uses separate requests and preserves recoverable progress on error', async () => {
  const api = service(); const bodies = [], progress = [];
  const send = async (_url, options) => {
    const body = JSON.parse(options.body); bodies.push(body);
    const result = await api.post(body); return Response.json(result.data, { status: result.status });
  };
  const complete = await core.runAdvisorRequests({ challenge }, s => progress.push(s), send);
  assert.equal(complete.completedSections, 3); assert.deepEqual(bodies.map(b => b.step), [undefined, 0, 1, 2]);
  assert.deepEqual(progress.map(s => s.completedSections), [0, 1, 2, 3]);
  const partial = { ...complete, completedSections: 1 };
  const continued = [];
  await assert.rejects(core.runAdvisorRequests({ session: partial }, s => continued.push(s), async () => Response.json({ error: 'Try again', session: partial }, { status: 503 })), /Try again/);
  assert.equal(continued[0].completedSections, 1);
  const resumeBodies = [];
  await core.runAdvisorRequests({ session: partial }, () => {}, async (_url, options) => {
    const body = JSON.parse(options.body); resumeBodies.push(body);
    return Response.json({ session: { ...partial, completedSections: body.step + 1 } });
  });
  assert.deepEqual(resumeBodies.map(b => b.step), [1, 2]);
});

test('browser orchestration stops on a bad response instead of looping', async () => {
  const session = { id: 'x', completedSections: 0 };
  await assert.rejects(core.runAdvisorRequests({ session }, () => {}, async () => Response.json({ session })), /progress is saved/);
});

test('ordinary chat saves cannot forge resumable Advisor progress', async () => {
  let stored;
  const route = load('app/api/ai/chat/sessions/route.ts', {
    'next/server': { NextResponse: class extends Response { static json(data, init) { return Response.json(data, init); } } },
    '@/auth': { auth: async () => ({ user: { id: 'member-1' } }) },
    '@/lib/db': { db: { user: { findUnique: async () => ({ tier: 'APEX' }) }, chatSession: { create: async ({ data }) => { stored = data; return data; } } } },
  });
  const response = await route.POST(new Request('https://fortify.test/api/ai/chat/sessions', { method: 'POST', body: JSON.stringify({ title: 'Strategy: forged', messages: core.advisorMessages(challenge, core.initialAdvisorProgress()) }) }));
  assert.equal(response.status, 200);
  assert.equal(core.readAdvisorProgress(stored.messages), null);
  assert.equal(stored.messages[0].content, challenge);
});

test('a late response from an expired lease cannot overwrite a newer section', async () => {
  let release, entered, calls = 0;
  const started = new Promise(resolve => entered = resolve);
  const blocked = new Promise(resolve => release = resolve);
  const api = service({ generate: async () => {
    calls++;
    if (calls === 1) { entered(); await blocked; }
    return { content: [{ type: 'text', text: calls === 1 ? 'Old result' : 'New result' }], stop_reason: 'end_turn' };
  } });
  const session = await start(api);
  const first = api.post({ sessionId: session.id, step: 0 }); await started;
  api.rows.get(session.id).messages[0].advisor.leaseUntil = Date.now() - 1;
  assert.equal((await api.post({ sessionId: session.id, step: 0 })).status, 200);
  release(); assert.equal((await first).status, 409);
  assert.equal(core.readAdvisorProgress(api.rows.get(session.id).messages).sections[0], 'New result');
});

test('saved partial sessions expose Continue and model markup is escaped', () => {
  const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const partial = { id: 'partial', title: 'Strategy: Outreach', createdAt: new Date().toISOString(), completedSections: 1,
    messages: [{ role: 'user', content: challenge }, { role: 'assistant', content: '## Diagnosis\n<img src=x onerror=alert(1)>' }] };
  function render(session) {
    const states = [[session], '', false, '', session, null]; let index = 0;
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync('components/advisor-client.tsx', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(code, { exports, Date, require: name => name === 'react' ? { ...React, useState: () => [states[index++], () => {}] }
      : name === '@/lib/advisor-run' ? core : require(name) });
    return renderToStaticMarkup(React.createElement(exports.AdvisorClient, { pastSessions: [session] }));
  }
  const html = render(partial);
  assert.match(html, /Continue session/); assert.match(html, /1 of 3 sections saved/);
  assert.ok(!html.includes('<img')); assert.match(html, /&lt;img/);
  assert.ok(!render({ ...partial, completedSections: null }).includes('Continue session'));
  assert.ok(!render({ ...partial, completedSections: 3 }).includes('Continue session'));
});
