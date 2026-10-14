const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { load } = require('./test-module-loader.cjs');

const pureContext = load('lib/business-context.ts');
const validation = load('lib/lead-sourcing-validation.ts');

test('business context tolerates malformed data, ignores blanks and bounds content', () => {
  for (const input of [null, {}, 'bad', [null, {}, { content: 42 }]]) assert.equal(pureContext.buildBusinessContext(input), '');
  const output = pureContext.buildBusinessContext([{ label: 'Audience', content: ' Small agencies ' }, { label: 'bad', content: '' }]);
  assert.match(output, /Audience: Small agencies/);
  assert.match(output, /not independently verified/);
  assert.match(output, /not treat these facts as evidence about a prospect/);
  assert.ok(pureContext.buildBusinessContext([{ content: 'x'.repeat(100000) }]).length < 12500);
});

test('context lookups scope explicit voices to the user and null disables the active voice', async () => {
  const lookups = [];
  const store = load('lib/business-context-store.ts', {
    '@/lib/business-context': pureContext,
    '@/lib/client-context': { clientContext: async () => { throw new Error('Unexpected client lookup'); } },
    '@/lib/db': { db: {
      companyDna: { findUnique: async q => { assert.equal(q.where.userId, 'u1'); return { entries: [{ label: 'Offer', content: 'Research' }] }; } },
      brandVoice: { findFirst: async q => { lookups.push(q.where); return { name: 'K', systemPrompt: 'Short sentences' }; } },
    } },
  });
  assert.equal((await store.loadBusinessContext('u1', null)).voice, null);
  assert.equal(lookups.length, 0);
  assert.equal((await store.loadBusinessContext('u1', 'v1')).contextUsed.brandVoice, 'K');
  assert.equal(lookups[0].userId, 'u1'); assert.equal(lookups[0].id, 'v1');
  await store.loadBusinessContext('u1'); assert.equal(lookups[1].isActive, true);
});

test('lead input rejects malformed values before spending', () => {
  for (const input of [null, [], { icp: 123 }, { icp: 'abc' }, { icp: 'abcde', signal: {} }, { icp: 'x'.repeat(201) }]) assert.equal(validation.parseLeadRequest(input), null);
  assert.equal(validation.parseLeadRequest({ icp: '  small agencies  ' }).icp, 'small agencies');
});

const sources = [{ url: 'https://agency.test/', description: 'Publishes content for founders' }];
const lead = { company: 'Agency', website: sources[0].url, fitScore: 8, fitReason: 'Relevant services', hook: 'Your founder content' };
test('lead output rejects invented URLs and malformed scores, dedupes and attaches provenance', () => {
  const results = validation.validateLeadResults([lead, lead, { ...lead, website: 'https://invented.test/' }, { ...lead, fitScore: 99 }, null], sources, '2026-10-11');
  assert.equal(results.length, 1); assert.equal(results[0].verification, 'discovered_unverified');
  assert.equal(results[0].sourceExcerpt, sources[0].description); assert.equal(results[0].researchedAt, '2026-10-11');
  assert.throws(() => validation.validateLeadResults({}, sources, 'today'));
});

function creditFixture(startCredits = 50) {
  let credits = startCredits, ledger = new Map(), serial = Promise.resolve(), seq = 0;
  let failLedger = false;
  const user = {
    updateMany: async ({ where, data }) => {
      if (where.id !== 'u1' || credits < where.credits.gte) return { count: 0 };
      credits -= data.credits.decrement; return { count: 1 };
    },
    update: async ({ data }) => { credits += data.credits.increment; return { credits }; },
  };
  const creditTransaction = {
    create: async ({ data }) => {
      if (failLedger) throw new Error('Ledger unavailable');
      const id = data.id || `debit${++seq}`;
      if (ledger.has(id)) throw Object.assign(new Error('Duplicate'), { code: 'P2002' });
      const row = { id, ...data }; ledger.set(id, row); return row;
    },
    findUnique: async ({ where }) => ledger.get(where.id) || null,
  };
  const db = { creditTransaction, $transaction: fn => {
    const run = serial.then(async () => {
      const beforeCredits = credits, beforeLedger = new Map(ledger);
      try { return await fn({ user, creditTransaction }); }
      catch (error) { credits = beforeCredits; ledger = beforeLedger; throw error; }
    });
    serial = run.catch(() => {}); return run;
  } };
  const api = load('lib/credit-reservation.ts', { '@/lib/db': { db } });
  return { api, credits: () => credits, ledger: () => [...ledger.values()], failLedger: () => { failLedger = true; } };
}

test('concurrent reservations cannot overspend a balance', async () => {
  const f = creditFixture();
  const results = await Promise.all([f.api.reserveCredits('u1', 50, 'spend_leads'), f.api.reserveCredits('u1', 50, 'spend_leads')]);
  assert.equal(results.filter(Boolean).length, 1); assert.equal(f.credits(), 0); assert.equal(f.ledger().length, 1);
});
test('refund retries restore the original balance exactly once', async () => {
  const f = creditFixture(); const debit = await f.api.reserveCredits('u1', 50, 'spend_leads');
  await Promise.all([f.api.refundCredits(debit), f.api.refundCredits(debit)]);
  assert.equal(f.credits(), 50); assert.equal(f.ledger().length, 2);
});
test('ledger failure rolls back a debit', async () => {
  const f = creditFixture(); f.failLedger();
  await assert.rejects(f.api.reserveCredits('u1', 50, 'spend_leads')); assert.equal(f.credits(), 50);
});

class NextResponse extends Response {
  static json(body, init) { return new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json' } }); }
}
function leadRouteFixture({ results = sources, output = JSON.stringify([lead]), fail = false, credits = 50, generationFail = false } = {}) {
  const f = creditFixture(credits); const requests = [];
  const route = load('app/api/leads/source/route.ts', {
    'next/server': { NextResponse }, '@/auth': { auth: async () => ({ user: { id: 'u1' } }) },
    '@/lib/db': { db: { user: { findUnique: async () => ({ tier: 'PRO' }) }, generation: { create: async () => { if (generationFail) throw new Error('DB failure'); } } } },
    '@/lib/tiers': { TIER_LIMITS: { PRO: { leadSourcing: true } } },
    '@/lib/brave': { braveSearch: async () => { if (fail) throw new Error('Search offline'); return results; } },
    '@/lib/claude': { CLAUDE_MODELS: { fast: 'test-model' }, claude: () => ({ messages: { create: async req => { requests.push(req); return { content: [{ type: 'text', text: output }] }; } } }) },
    '@/lib/business-context-store': { loadBusinessContext: async () => ({ businessContext: 'Saved audience: agencies', contextUsed: { companyDna: true, brandVoice: null } }) },
    '@/lib/credit-reservation': f.api, '@/lib/lead-sourcing-validation': validation,
  });
  return { ...f, requests, post: body => route.POST(new Request('https://fortify.test/api/leads/source', { method: 'POST', body: JSON.stringify(body) })) };
}
test('invalid requests never debit credits or call AI', async () => {
  for (const body of [{ icp: 'x' }, { icp: 42 }, { icp: 'valid ICP', location: [] }]) {
    const f = leadRouteFixture(); const res = await f.post(body);
    assert.equal(res.status, 400); assert.equal(f.credits(), 50); assert.equal(f.ledger().length, 0); assert.equal(f.requests.length, 0);
  }
});
test('insufficient balance stops provider calls', async () => {
  const f = leadRouteFixture({ credits: 49 }); const res = await f.post({ icp: 'Small agencies' });
  assert.equal(res.status, 402); assert.equal(f.requests.length, 0); assert.equal(f.credits(), 49);
});
for (const [name, options] of [['empty search', { results: [] }], ['provider failure', { fail: true }], ['malformed AI', { output: 'not JSON' }], ['empty AI results', { output: '[]' }], ['invented URL', { output: JSON.stringify([{ ...lead, website: 'https://invented.test/' }]) }], ['save failure', { generationFail: true }]]) {
  test(`${name} refunds reserved lead credits`, async () => {
    const f = leadRouteFixture(options); const res = await f.post({ icp: 'Small agencies' });
    assert.equal(f.credits(), 50); assert.equal(f.ledger().length, 2);
    if (res.status === 200) assert.equal((await res.json()).creditsUsed, 0);
    else assert.equal(res.status, 502);
  });
}
test('successful lead search charges once, uses context and returns evidence', async () => {
  const f = leadRouteFixture(); const res = await f.post({ icp: 'Small agencies' }); const body = await res.json();
  assert.equal(res.status, 200); assert.equal(f.credits(), 0); assert.equal(f.ledger().length, 1);
  assert.equal(body.creditsUsed, 50); assert.equal(body.leads[0].sourceUrl, sources[0].url);
  assert.equal(body.contextUsed.companyDna, true); assert.match(f.requests[0].system, /Saved audience: agencies/);
});
test('paid onboarding uses real workflow steps and free onboarding does not imply paid access', () => {
  const { buyerOnboarding } = load('lib/buyer-onboarding.ts');
  const progress = { dna: false, voice: false, research: false, draft: false };
  assert.equal(buyerOnboarding('ELITE', progress).length, 4);
  assert.equal(buyerOnboarding('ELITE', { dna: true, voice: true, research: true, draft: true }).every(x => x.done), true);
  assert.equal(buyerOnboarding('FREE', progress).every(x => x.href === '/pricing' || x.href.startsWith('/dashboard#')), true);
});
test('pricing and backend share chat budgets and distinguish drafting from sending', () => {
  const policy = load('lib/chat-allowance.ts'); assert.equal(policy.CHAT_BUDGET_GBP.PRO, 1); assert.equal(policy.CHAT_BUDGET_GBP.ELITE, 5);
  const pricing = fs.readFileSync('app/pricing/page.tsx', 'utf8');
  assert.match(pricing, /CHAT_BUDGET_GBP/); assert.match(pricing, /not automatic sends/); assert.doesNotMatch(pricing, /unlimited AI chat/i);
});

const context = { businessContext: 'Saved Company DNA: founders', voice: { name: 'K', systemPrompt: 'Write short sentences' }, contextUsed: { companyDna: true, brandVoice: 'K' } };
const authMock = { auth: async () => ({ user: { id: 'u1' } }) };
const usageMock = { canGenerate: async () => true, checkMonthly: async () => ({ ok: true, used: 0 }), logGeneration: async () => {} };
test('hook endpoint passes business context and the active voice to the real generation call', async () => {
  let captured;
  const route = load('app/api/ai/hook/route.ts', {
    'next/server': { NextResponse }, '@/auth': authMock,
    '@/lib/db': { db: { user: { findUnique: async () => ({ tier: 'PRO' }) } } },
    '@/lib/usage': usageMock, '@/lib/business-context-store': { loadBusinessContext: async () => context },
    '@/lib/openai': { generateHooks: async () => { throw new Error('Should use saved voice'); } },
    '@/lib/voice': { generateInVoice: async req => { captured = req; return 'A useful hook\nAnother hook'; } },
  });
  const res = await route.POST(new Request('https://fortify.test/hook', { method: 'POST', body: JSON.stringify({ topic: 'Research' }) }));
  const body = await res.json(); assert.equal(res.status, 200);
  assert.match(captured.userPrompt, /Saved Company DNA: founders/); assert.match(captured.systemPrompt, /Write short sentences/);
  assert.equal(body.contextUsed.companyDna, true); assert.equal(body.voice, 'K');
});
test('outreach endpoint preserves explicit no-voice selection and passes Company DNA', async () => {
  let selection, captured;
  const route = load('app/api/ai/outreach/route.ts', {
    'next/server': { NextResponse }, '@/auth': authMock,
    '@/lib/db': { db: { user: { findUnique: async () => ({ tier: 'PRO' }) } } },
    '@/lib/tiers': { TIER_LIMITS: { PRO: { monthlyOutreach: 50 } } }, '@/lib/usage': usageMock,
    '@/lib/notifications': { sendDMConditional: async () => {} }, '@/lib/abuse': { flagAbuse: async () => {} },
    '@/lib/rate-limit': { rateLimit: () => ({ ok: true }) },
    '@/lib/business-context-store': { loadBusinessContext: async (userId, voiceId) => { selection = voiceId; assert.equal(userId, 'u1'); return { ...context, voice: null, contextUsed: { companyDna: true, brandVoice: null } }; } },
    '@/lib/outreach': { OUTREACH_CHANNELS: ['email'], generateOutreach: async req => { captured = req; return 'An outreach draft'; } },
  });
  const res = await route.POST(new Request('https://fortify.test/outreach', { method: 'POST', body: JSON.stringify({ prospect: 'A founder researching competitors', offer: 'A research demonstration', channel: 'email', voiceId: null }) }));
  assert.equal(res.status, 200); assert.equal(selection, null); assert.equal(captured.voiceSystemPrompt, undefined);
  assert.equal(captured.businessContext, context.businessContext); assert.equal((await res.json()).voice, null);
});

function workflowFixture(nodeType = 'ai_generate', searchResults = sources, options = {}) {
  const requests = [], refunds = [], runs = [];
  const nodes = [
    { id: 't', type: 'trigger_schedule', label: 'Trigger', config: { cron: '0 9 * * *' } },
    { id: 'a', type: nodeType, label: 'Action', config: nodeType === 'ai_generate' ? { prompt: 'Write a content idea', model: 'haiku', maxTokens: '300' } : { icp: 'Small agencies' } },
  ];
  const runner = load('lib/workflow-runner.ts', {
    '@anthropic-ai/sdk': { default: class { messages = { create: async req => { requests.push(req); return { content: [{ type: 'text', text: nodeType === 'ai_generate' ? 'Useful draft' : JSON.stringify([lead]) }] }; } }; } },
    'resend': { Resend: class {} },
    '@/lib/db': { db: {
      workflow: { findFirst: async () => ({ id: 'wf1', clientWorkspaceId: options.clientId || null, nodes: options.graph || { nodes, connections: [{ fromId: 't', fromPort: 'out', toId: 'a' }] } }), update: async () => {} },
      user: { findUnique: async () => ({ tier: 'ELITE', credits: 50 }) },
      workflowRun: { create: async () => ({ id: 'run1' }), update: async row => runs.push(row) },
      socialConnection: { findFirst: async () => null }, generation: { create: async () => {} },
    } },
    '@/lib/workflow-capacity': { getCapacityInfo: async () => ({ isUnlimited: false, remaining: 10000 }) },
    '@/lib/workflow-starters': load('lib/workflow-starters.ts'),
    '@/lib/brave': { braveSearch: async () => searchResults },
    '@/lib/business-context-store': { loadBusinessContext: async (userId, _voice, clientId) => { assert.equal(userId, 'u1'); assert.equal(clientId, options.clientId || null); return options.context || context; } },
    '@/lib/credit-reservation': { reserveCredits: async () => ({ id: 'debit1' }), refundCredits: async reservation => refunds.push(reservation.id) },
    '@/lib/lead-sourcing-validation': validation,
    '@/lib/workflow-run-claim': { claimWorkflowRun: async () => ({ run: { id: 'run1' }, existing: false }), CAPACITY_PER_RUN: 100 },
    '@/lib/public-page': { readPublicPage: async url => { if (!options.page) throw new Error('Unexpected page fetch'); return { url, html: options.page }; } },
    '@/lib/competitor-diff': load('lib/competitor-diff.ts'),
    '@/lib/workflow-retry': load('lib/workflow-retry.ts'),
    '@/lib/workflow-schedule': load('lib/workflow-schedule.ts', { '@/lib/workflow-starters': load('lib/workflow-starters.ts') }),
  });
  return { run: () => runner.runWorkflow('wf1', 'u1', options.payload), requests, refunds, runs };
}
test('real workflow generation uses saved context and voice and completes a logged draft', async () => {
  const f = workflowFixture(); const result = await f.run(); assert.equal(result.status, 'completed');
  assert.match(f.requests[0].system, /Saved Company DNA: founders/); assert.match(f.requests[0].system, /Write short sentences/);
  assert.equal(f.runs[0].data.log[1].output, 'Useful draft');
});
test('workflow lead search refunds empty results and does not call AI', async () => {
  const f = workflowFixture('action_lead_search', []); assert.equal((await f.run()).status, 'completed');
  assert.equal(f.refunds.length, 1); assert.equal(f.requests.length, 0);
});
test('workflow lead search keeps successful research provenance and uses business context', async () => {
  const f = workflowFixture('action_lead_search'); assert.equal((await f.run()).status, 'completed');
  assert.equal(f.refunds.length, 0); assert.match(f.requests[0].system, /Saved Company DNA: founders/);
});

test('connected page research produces sourced drafts with the pinned client context', async () => {
  const starter = structuredClone(load('lib/workflow-starters.ts').getWorkflowStarter('research-to-content'));
  starter.nodes.find(node => node.id === 'research').config.url = 'https://agency.test/pricing';
  const f = workflowFixture('ai_generate', sources, { graph: starter, clientId: 'client-a', context: { ...context, businessContext: 'Only Client A context' }, page: '<main><h1>Consulting for founders</h1><p>We offer three monthly packages for research and content planning, starting at £79 per month. All plans include one weekly briefing.</p></main>' });
  assert.equal((await f.run()).status, 'completed');
  assert.match(f.requests[0].messages[0].content, /https:\/\/agency.test\/pricing/);
  assert.match(f.requests[0].messages[0].content, /£79/);
  assert.match(f.requests[0].system, /Only Client A context/);
  assert.doesNotMatch(f.requests[0].system, /Saved Company DNA: founders/);
  assert.equal(f.runs[0].data.log.at(-1).output, 'Useful draft');
});

test('competitor starter refuses to invent a change on a manual run', async () => {
  const graph = load('lib/workflow-starters.ts').getWorkflowStarter('competitor-to-content');
  const f = workflowFixture('ai_generate', sources, { graph });
  assert.equal((await f.run()).status, 'failed'); assert.equal(f.requests.length, 0);
});

test('competitor evidence reaches the connected content draft', async () => {
  const graph = load('lib/workflow-starters.ts').getWorkflowStarter('competitor-to-content');
  const f = workflowFixture('ai_generate', sources, { graph, payload: { watchChanges: 'Price changed from £79 to £89', watchEvidence: JSON.stringify({ sourceUrl: 'https://agency.test/pricing', added: ['£89'] }) } });
  assert.equal((await f.run()).status, 'completed');
  assert.match(f.requests[0].messages[0].content, /£79 to £89/); assert.match(f.requests[0].messages[0].content, /https:\/\/agency.test\/pricing/);
});
