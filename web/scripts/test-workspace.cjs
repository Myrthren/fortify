const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function fixture() {
  const at = new Date('2026-10-20T10:00:00Z');
  const state = { session: { user: { id: 'alice' } }, writes: 0, reads: 0, aiCalls: 0, offline: false, stale: false, preference: null, history: [], workflows: [],
    leads: [ { id: 'alice-lead', userId: 'alice', url: 'https://example.com/', company: 'Existing', status: 'contacted', source: 'recon', context: 'Original research', notes: 'Keep my notes', draft: 'Keep my draft', email: null, followUpAt: null, createdAt: at, updatedAt: at },
      { id: 'bob-lead', userId: 'bob', url: 'https://private.example/', company: 'Bob private', status: 'new', notes: 'Private notes', draft: null, updatedAt: at, createdAt: at } ] };
  const match = (lead, where) => (!where.userId || lead.userId === where.userId) && (!where.id || (typeof where.id === 'string' ? lead.id === where.id : lead.id < where.id.lt)) && (!where.url || (typeof where.url === 'string' ? lead.url === where.url : where.url.in.includes(lead.url))) && (!where.updatedAt || lead.updatedAt.getTime() === where.updatedAt.getTime());
  const scoped = where => { state.reads++; assert.equal(where.userId ?? where.watch?.userId, 'alice', 'every activity query is scoped to the signed-in user'); };
  const db = {
    contentRecord: { findMany: async () => [], count: async () => 0 },
    user: { findUnique: async () => ({ id: 'alice', tier: 'FREE' }) },
    brandVoice: { findFirst: async () => null },
    leadStatus: {
      findFirst: async ({ where }) => { state.reads++; return state.leads.find(lead => match(lead, where)) ?? null; },
      findMany: async ({ where }) => { scoped(where); return state.leads.filter(lead => match(lead, where)); },
      count: async ({ where }) => { scoped(where); return where.draft ? state.leads.filter(lead => lead.userId === 'alice' && lead.draft).length : 0; },
      groupBy: async ({ where }) => { scoped(where); const counts = {}; for (const lead of state.leads.filter(item => item.userId === where.userId)) counts[lead.status] = (counts[lead.status] ?? 0) + 1; return Object.entries(counts).map(([status, _count]) => ({ status, _count })); },
      upsert: async ({ where, create, update }) => { if (state.offline) throw Error('offline'); const key = where.userId_url; let lead = state.leads.find(item => item.userId === key.userId && item.url === key.url); if (lead) Object.assign(lead, Object.fromEntries(Object.entries(update).filter(([,value]) => value !== undefined))); else { lead = { id: 'new-lead', notes: '', draft: null, createdAt: at, updatedAt: at, ...create }; state.leads.push(lead); } state.writes++; return { ...lead }; },
      update: async ({ where, data }) => { const lead = state.leads.find(item => match(item, where)); assert.ok(lead); if (state.offline) throw Error('offline'); Object.assign(lead, Object.fromEntries(Object.entries(data).filter(([,value]) => value !== undefined))); state.writes++; return { ...lead }; },
      updateMany: async ({ where, data }) => { if (state.offline) throw Error('offline'); const lead = state.leads.find(item => match(item, where)); if (!lead || state.stale) return { count: 0 }; Object.assign(lead, data, { updatedAt: new Date(at.getTime() + 1000) }); state.writes++; return { count: 1 }; },
    },
    workspacePreference: {
      findUnique: async ({ where }) => { scoped(where); return state.preference; },
      upsert: async ({ where, create, update }) => { assert.equal(where.userId, 'alice'); if (state.offline) throw Error('offline'); state.preference = state.preference ? { ...state.preference, ...update } : { dismissed: false, ...create }; state.writes++; return state.preference; },
    },
    generation: { findMany: async ({ where }) => { scoped(where); return []; }, groupBy: async ({ where }) => { scoped(where); return []; } },
    reconSearch: { findMany: async ({ where }) => { scoped(where); return []; } },
    workflow: { findMany: async ({ where }) => { scoped(where); return state.workflows; } },
    competitorWatchScan: { findMany: async ({ where }) => { scoped(where); return []; }, count: async ({ where }) => { scoped(where); return 0; } },
    competitorWatch: { count: async ({ where }) => { scoped(where); return 0; } },
    watchTerm: { count: async ({ where }) => { scoped(where); return 0; } },
  };
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative.endsWith('.ts') ? relative : relative + '.ts');
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    function localRequire(name) {
      if (name === 'next/server') return { NextResponse: Object.assign(Response, { json: Response.json }) };
      if (name === '@/auth') return { auth: async () => state.session };
      if (name === '@/lib/db') return { db };
      if (name === '@/lib/rate-limit') return { rateLimit: () => ({ ok: true }) };
      if (name === '@/lib/tiers') return { TIER_LIMITS: { FREE: { monthlyOutreach: 10 } } };
      if (name === '@/lib/usage') return { checkMonthly: async () => ({ ok: true, used: 0 }), logGeneration: async item => state.history.push(item) };
      if (name === '@/lib/notifications') return { sendDMConditional: async () => {} };
      if (name === '@/lib/abuse') return { flagAbuse: async () => {} };
      if (name === '@/lib/outreach') return { OUTREACH_CHANNELS: ['dm', 'email', 'linkedin', 'cold-email'], generateOutreach: async () => { state.aiCalls++; return 'A specific generated message.'; } };
      return load(name.startsWith('@/') ? name.slice(2) : path.relative(root, path.resolve(path.dirname(file), name)));
    }
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  }
  return { state, load, post: load('app/api/pipeline/route').POST, list: load('app/api/pipeline/route').GET, patch: load('app/api/pipeline/[id]/route').PATCH, goal: load('app/api/workspace/goal/route').PATCH, activity: load('app/api/workspace/activity/route').GET, outreach: load('app/api/ai/outreach/route').POST };
}
const req = (body, method = 'POST', origin = 'https://fortify-io.com') => new Request('https://fortify-io.com/api/pipeline', { method, headers: { 'Content-Type': 'application/json', origin }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const params = id => ({ params: Promise.resolve({ id }) });
const lead = { company: 'Acme', url: 'https://acme.example', source: 'manual' };
const outreachBody = id => ({ prospect: 'A founder looking for a better booking website.', offer: 'We build useful booking websites.', channel: 'email', pipelineLeadId: id });

test('signed-out and malformed sessions cannot read or write workspace data', async () => {
  for (const session of [null, { user: {} }, { user: { id: 123 } }]) {
    const f = fixture(); f.state.session = session;
    for (const action of [() => f.post(req(lead)), () => f.list(new Request('https://fortify-io.com/api/pipeline')), () => f.patch(req({ notes: 'x' }, 'PATCH'), params('alice-lead')), () => f.goal(req({ goal: 'clients' }, 'PATCH')), () => f.activity()]) assert.equal((await action()).status, 401);
    assert.equal(f.state.reads, 0); assert.equal(f.state.writes, 0);
  }
});
test('foreign and missing origins cannot mutate leads or workspace focus', async () => {
  const f = fixture();
  for (const origin of ['', 'null', 'https://elsewhere.example']) {
    assert.equal((await f.post(req(lead, 'POST', origin))).status, 403);
    assert.equal((await f.patch(req({ notes: 'x' }, 'PATCH', origin), params('alice-lead'))).status, 403);
    assert.equal((await f.goal(req({ goal: 'clients' }, 'PATCH', origin))).status, 403);
  }
  assert.equal(f.state.writes, 0);
});
test('invalid imports are rejected before storage and never accept executable URLs', async () => {
  const f = fixture();
  for (const input of [{ ...lead, url: 'javascript:alert(1)' }, { ...lead, url: 'https://user:password@example.com' }, { ...lead, company: '' }, { ...lead, source: 'forged' }, { ...lead, email: 'wrong' }, { ...lead, context: 'x'.repeat(6001) }, 'null', '[1]', '{bad']) assert.equal((await f.post(req(input))).status, 400);
  assert.equal(f.state.writes, 0);
});
test('saving a previously tracked Recon business preserves its stage, notes and draft', async () => {
  const f = fixture(); const result = await f.post(req({ ...lead, url: 'https://example.com/?utm_source=ad', context: 'New research', draft: 'A stale imported draft' }));
  assert.equal(result.status, 200); const saved = (await result.json()).lead;
  assert.equal(saved.status, 'contacted'); assert.equal(saved.notes, 'Keep my notes'); assert.equal(saved.draft, 'Keep my draft'); assert.equal(saved.context, 'New research'); assert.equal(f.state.leads.length, 2);
});
test('the same URL in another account does not overwrite or expose its existing record', async () => {
  const f = fixture(); const result = await f.post(req({ ...lead, url: 'https://private.example/' }));
  assert.equal(result.status, 200); assert.equal((await result.json()).lead.userId, 'alice'); assert.equal(f.state.leads.find(item => item.id === 'bob-lead').notes, 'Private notes');
});
test('legacy tracking URLs remain one record and empty imports retain saved research', async () => {
  const f = fixture(); f.state.leads[0].url = 'https://example.com/?utm_source=legacy';
  const result = await f.post(req({ ...lead, url: f.state.leads[0].url, context: '', email: '' }));
  assert.equal(result.status, 200); assert.equal(f.state.leads.length, 2); assert.equal((await result.json()).lead.context, 'Original research');
});
test('cross-account edits return 404; stale edits return 409 and preserve existing work', async () => {
  const f = fixture(); const body = { notes: 'Overwrite', updatedAt: '2026-10-20T10:00:00Z' };
  assert.equal((await f.patch(req(body, 'PATCH'), params('bob-lead'))).status, 404);
  assert.equal((await f.patch(req({ ...body, updatedAt: '2026-10-19T10:00:00Z' }, 'PATCH'), params('alice-lead'))).status, 409);
  assert.equal(f.state.writes, 0); assert.equal(f.state.leads[0].notes, 'Keep my notes');
});
test('valid updates persist stages and follow-ups; invalid calendar dates do not write', async () => {
  const f = fixture(); const base = { updatedAt: '2026-10-20T10:00:00Z' };
  for (const data of [{ followUpAt: '2026-02-30' }, { followUpAt: 'tomorrow' }, { status: 'SENT' }, { notes: 'x'.repeat(6001) }, { email: 'invalid' }]) assert.equal((await f.patch(req({ ...base, ...data }, 'PATCH'), params('alice-lead'))).status, 400);
  const response = await f.patch(req({ ...base, status: 'replied', followUpAt: '2026-10-22', notes: 'Interested', draft: '' }, 'PATCH'), params('alice-lead'));
  assert.equal(response.status, 200); const saved = (await response.json()).lead; assert.equal(saved.status, 'replied'); assert.equal(saved.followUpAt.slice(0, 10), '2026-10-22'); assert.equal(saved.draft, null);
});
test('closed leads are never due and UTC date-only follow-ups stay stable', () => {
  const { dueToday } = fixture().load('lib/pipeline'); const now = new Date('2026-10-20T08:00:00Z');
  assert.equal(dueToday('2026-10-20T00:00:00Z', 'contacted', now), true); assert.equal(dueToday('2026-10-21T00:00:00Z', 'new', now), false);
  for (const stage of ['won', 'dead']) assert.equal(dueToday('2026-10-19T00:00:00Z', stage, now), false);
});
test('pipeline search and pagination retain account isolation and reject invalid filters', async () => {
  const f = fixture(), { pipelineWhere } = f.load('lib/pipeline-query');
  const where = pipelineWhere('alice', { q: 'Acme', view: 'due', cursor: 'older', stage: 'qualified', userId: 'bob' });
  assert.equal(where.userId, 'alice'); assert.deepEqual(where.id, { lt: 'older' }); assert.equal(where.status, 'qualified'); assert.ok(where.AND.some(item => item.status?.notIn.includes('won')));
  const response = await f.list(new Request('https://fortify-io.com/api/pipeline')); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.ok((await response.json()).leads.every(item => item.userId === 'alice'));
  assert.equal((await f.list(new Request('https://fortify-io.com/api/pipeline?stage=forged'))).status, 400);
});
test('goal selection is persistent, skippable and never erases the selected goal', async () => {
  const f = fixture(); assert.equal((await f.goal(req({ goal: 'clients', dismissed: false }, 'PATCH'))).status, 200);
  await f.goal(req({ dismissed: true }, 'PATCH')); assert.equal(f.state.preference.goal, 'clients'); assert.equal(f.state.preference.dismissed, true);
  await f.goal(req({ goal: 'content', dismissed: false }, 'PATCH')); assert.equal(f.state.preference.goal, 'content'); assert.equal(f.state.preference.dismissed, false);
  assert.equal((await f.goal(req({ goal: 'made-up' }, 'PATCH'))).status, 400);
});
test('free-account goal paths remain usable and progress requires actual saved work', () => {
  const { goalSteps } = fixture().load('lib/workspace-goals'); const empty = { leads: 0, drafts: 0, content: 0, research: 0, watches: 0 };
  for (const goal of ['clients', 'content', 'research']) { const steps = goalSteps(goal, empty, 'FREE'); assert.equal(steps.filter(item => item.done).length, 1); assert.ok(steps.every(item => !/pricing|company-dna|competitors|competitor-tracking/.test(item.href))); }
  assert.ok(goalSteps('clients', { ...empty, leads: 1, drafts: 1 }, 'FREE').every(item => item.done));
});
test('activity derives only real records and a resolved workflow failure is not an open task', async () => {
  const f = fixture(); f.state.leads = []; f.state.workflows = [{ id: 'wf1', name: 'Fixed workflow', runs: [{ id: 'run2', status: 'completed', startedAt: new Date('2026-10-20T10:00:00Z') }] }];
  const response = await f.activity(); assert.equal(response.status, 200); const data = await response.json(); assert.deepEqual(data.metrics, { openLeads: 0, dueFollowUps: 0, failedWorkflows: 0, competitorChanges: 0 }); assert.equal(data.attention.length, 0); assert.equal(data.activity.length, 1); assert.equal(data.activity[0].detail, 'Workflow completed');
});
test('outreach cannot use another account lead and does not call AI for it', async () => {
  const f = fixture(); assert.equal((await f.outreach(req(outreachBody('bob-lead')))).status, 404); assert.equal(f.state.aiCalls, 0); assert.equal(f.state.history.length, 0);
});
test('generated outreach returns to its saved prospect without marking it contacted or regressing progress', async () => {
  for (const stage of ['new', 'qualified', 'contacted', 'replied', 'won']) {
    const f = fixture(); f.state.leads[0].status = stage; const response = await f.outreach(req(outreachBody('alice-lead')));
    assert.equal(response.status, 200); assert.equal((await response.json()).pipelineSaved, true); assert.equal(f.state.leads[0].status, ['new', 'qualified'].includes(stage) ? 'draft-ready' : stage); assert.equal(f.state.leads[0].draft, 'A specific generated message.'); assert.equal(f.state.history.length, 1);
  }
});
test('concurrent lead edits preserve the old draft and still keep the generated result in history', async () => {
  const f = fixture(); f.state.stale = true; const response = await f.outreach(req(outreachBody('alice-lead'))); const body = await response.json(); assert.equal(body.pipelineSaved, false); assert.ok(body.warning); assert.equal(body.message, 'A specific generated message.'); assert.equal(f.state.leads[0].draft, 'Keep my draft'); assert.equal(f.state.history.length, 1);
});
test('storage failures report errors and never pretend writes succeeded', async () => {
  const f = fixture(); f.state.offline = true; assert.equal((await f.post(req(lead))).status, 503); assert.equal((await f.goal(req({ goal: 'clients' }, 'PATCH'))).status, 503); assert.equal(f.state.writes, 0);
});
