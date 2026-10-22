const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');

// A serialized, rollback-capable transaction double. These tests exercise the
// route and settlement code; they do not claim live PostgreSQL/provider coverage.
function harness(credits = 100) {
  let state = { credits, receipts: {}, generations: {}, competitors: {}, seq: 0 };
  let queue = Promise.resolve();
  const make = (get) => ({
    user: {
      findUnique: async () => ({ id: 'u', tier: 'ELITE', credits: get().credits }),
      updateMany: async ({ where, data }) => {
        if (get().credits < where.credits.gte) return { count: 0 };
        get().credits -= data.credits.decrement;
        return { count: 1 };
      },
    },
    creditTransaction: {
      findUnique: async ({ where }) => get().receipts[where.id] ?? null,
      create: async ({ data }) => {
        const id = data.id ?? `receipt-${++get().seq}`;
        if (get().receipts[id]) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        return get().receipts[id] = { ...data, id };
      },
    },
    generation: {
      findUnique: async ({ where }) => get().generations[where.id] ?? null,
      create: async ({ data }) => {
        const id = data.id ?? `generation-${++get().seq}`;
        return get().generations[id] = { ...data, id };
      },
      update: async ({ where, data }) => Object.assign(get().generations[where.id], data),
    },
    competitor: {
      findUnique: async () => ({ id: 'c', userId: 'u', name: 'Test business', url: 'https://example.org' }),
      update: async ({ where, data }) => get().competitors[where.id] = data,
    },
  });
  const db = make(() => state);
  db.$transaction = fn => {
    const run = queue.then(async () => {
      const staged = structuredClone(state);
      const value = await fn(make(() => staged));
      state = staged;
      return value;
    });
    queue = run.catch(() => {});
    return run;
  };
  const credit = load('lib/result-credits.ts', { '@/lib/db': { db } });
  return { db, credit, state: () => state };
}
const next = { NextResponse: class extends Response {
  static json(body, init) { return new this(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json' } }); }
} };
const auth = { auth: async () => ({ user: { id: 'u' } }) };
const rateLimit = { rateLimit: () => ({ ok: true }) };
const request = (url, body) => new Request(`https://fortify.test${url}`, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: 'c' }) };
const json = text => ({ content: [{ type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text) }] });
const source = [{ title: 'Business', url: 'https://example.org', description: 'Design agency' }];
const lead = { company: 'Business', website: source[0].url, fitScore: 8, fitReason: 'Design agency', hook: 'Your design work' };
function leadRoute(h, results = source, output = [lead]) {
  return load('app/api/leads/source/route.ts', {
    'next/server': next, '@/auth': auth, '@/lib/db': { db: h.db }, '@/lib/result-credits': h.credit,
    '@/lib/tiers': { TIER_LIMITS: { ELITE: { leadSourcing: true } } },
    '@/lib/brave': { braveSearch: async () => results },
    '@/lib/claude': { CLAUDE_MODELS: { fast: 'mock' }, claude: () => ({ messages: { create: async () => {
      if (output instanceof Error) throw output;
      return json(output);
    } } }) },
  });
}
for (const [label, results, output, body] of [
  ['invalid input', source, [lead], { icp: 7 }],
  ['empty search', [], [], { icp: 'design agencies' }],
  ['empty model list', source, [], { icp: 'design agencies' }],
  ['wrong output shape', source, {}, { icp: 'design agencies' }],
  ['malformed JSON', source, '[broken]', { icp: 'design agencies' }],
  ['invented URL', source, [{ ...lead, website: 'https://invented.example' }], { icp: 'design agencies' }],
  ['provider failure', source, new Error('provider unavailable'), { icp: 'design agencies' }],
]) test(`lead sourcing: ${label} never charges`, async () => {
  const h = harness();
  await leadRoute(h, results, output).POST(request('/api/leads/source', body));
  assert.equal(h.state().credits, 100);
  assert.equal(Object.keys(h.state().receipts).length, 0);
});
test('valid lead result saves output and charges exactly 50', async () => {
  const h = harness();
  const response = await leadRoute(h).POST(request('/api/leads/source', { icp: 'design agencies' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).creditsUsed, 50);
  assert.equal(h.state().credits, 50);
  assert.equal(Object.keys(h.state().generations).length, 1);
});
test('failed result persistence rolls back the debit and receipt', async () => {
  const h = harness();
  await assert.rejects(h.credit.chargeForResult('u', 50, 'tool', async () => { throw new Error('disk/database failure'); }));
  assert.equal(h.state().credits, 100);
  assert.equal(Object.keys(h.state().receipts).length, 0);
});
test('competing valid jobs cannot overspend the balance', async () => {
  const h = harness(50);
  const outcomes = await Promise.allSettled([h.credit.chargeForResult('u', 50, 'a'), h.credit.chargeForResult('u', 50, 'b')]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(h.state().credits, 0);
  assert.equal(Object.keys(h.state().receipts).length, 1);
});
test('async jobs are free to start, owner/tool bound, and concurrent completions charge once', async () => {
  const h = harness();
  await h.credit.registerCreditRun('u', 'run-1', 'ads:c');
  assert.equal(h.state().credits, 100);
  await assert.rejects(h.credit.readCreditRun('other', 'run-1', 'ads:c'));
  await assert.rejects(h.credit.readCreditRun('u', 'run-1', 'social:c'));
  const complete = () => h.credit.completeCreditRun('u', 'run-1', 'ads:c', 50, 'ads', { report: { summary: 'Real report' } });
  const results = await Promise.all([complete(), complete()]);
  assert.equal(h.state().credits, 50);
  assert.equal(Object.keys(h.state().receipts).length, 1);
  assert.deepEqual(results[0], results[1]);
  await complete();
  assert.equal(h.state().credits, 50);
});
function scanRoute(h, { status = 'SUCCEEDED', items = [{ snapshot: { body: { text: 'Actual ad copy' } } }], output } = {}) {
  return load('app/api/competitors/[id]/scan-ads/route.ts', {
    'next/server': next, '@/auth': auth, '@/lib/db': { db: h.db }, '@/lib/result-credits': h.credit,
    '@/lib/rate-limit': rateLimit,
    '@/lib/apify': { getRunStatus: async () => status, getDatasetItems: async () => items },
    '@/lib/claude': { CLAUDE_MODELS: { fast: 'mock' }, claude: () => ({ messages: { create: async () => json(output ?? { summary: 'Ad report', spendLevel: 'Unknown', adAngles: [], topCtaPatterns: [], offerFrameworks: [], platforms: [], topAds: [] }) } }) },
  });
}
for (const [label, options] of [['failed scrape', { status: 'FAILED' }], ['empty scrape', { items: [] }], ['invalid report', { output: {} }], ['running job', { status: 'RUNNING' }]]) {
  test(`async scan: ${label} never charges`, async () => {
    const h = harness();
    await h.credit.registerCreditRun('u', 'run', 'competitors/c/scan-ads');
    await scanRoute(h, options).GET(request('/api/competitors/c/scan-ads?runId=run'), params);
    assert.equal(h.state().credits, 100);
    assert.equal(Object.keys(h.state().receipts).length, 0);
  });
}
test('completed scan is saved, charged once, and replayed from saved output', async () => {
  const h = harness();
  await h.credit.registerCreditRun('u', 'run', 'competitors/c/scan-ads');
  const route = scanRoute(h);
  for (let i = 0; i < 3; i++) {
    const response = await route.GET(request('/api/competitors/c/scan-ads?runId=run'), params);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).creditsUsed, 50);
  }
  assert.equal(h.state().credits, 50);
  assert.equal(Object.keys(h.state().receipts).length, 1);
  assert.equal(h.state().competitors.c.metaAdReport.summary, 'Ad report');
});

test('async scrape error records are not billable data', async () => {
  const h = harness();
  await h.credit.registerCreditRun('u', 'run', 'competitors/c/scan-ads');
  const response = await scanRoute(h, { items: [{ error: 'scrape blocked' }] }).GET(request('/api/competitors/c/scan-ads?runId=run'), params);
  assert.equal((await response.json()).status, 'failed');
  assert.equal(h.state().credits, 100);
});
test('expired balance at completion leaves report pending and uncharged', async () => {
  const h = harness(10);
  await h.credit.registerCreditRun('u', 'run', 'ads:c');
  await assert.rejects(h.credit.completeCreditRun('u', 'run', 'ads:c', 50, 'ads', { report: {} }), /balance changed/);
  assert.equal(h.state().credits, 10);
  assert.equal(await h.credit.readCreditRun('u', 'run', 'ads:c'), null);
  assert.equal(Object.keys(h.state().receipts).length, 0);
});
function reconRoute(h, items, contextFails = false) {
  return load('app/api/recon/route.ts', {
    'next/server': next, '@/auth': auth, '@/lib/db': { db: h.db }, '@/lib/result-credits': h.credit,
    '@/lib/rate-limit': rateLimit,
    '@/lib/apify': { startRunAndWait: async () => 'run', getDatasetItems: async () => items },
    '@/lib/recon': { googleMapsInput: () => ({}), scrapeEmails: async () => [] },
    '@/lib/claude': { CLAUDE_MODELS: { fast: 'mock' }, claude: () => ({ messages: { create: async () => {
      if (contextFails) throw new Error('provider failed');
      return json('A sourced strategy');
    } } }) },
  });
}
test('Recon empty/closed listings cost zero', async () => {
  for (const items of [[], [{ title: 'Closed', permanentlyClosed: true }]]) {
    const h = harness(200);
    const response = await reconRoute(h, items).POST(request('/api/recon', { location: 'Kent', category: 'barbers', extractEmails: true, applyContext: true }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).creditsUsed, 0);
    assert.equal(h.state().credits, 200);
  }
});
test('contact extraction with no public contacts costs zero', async () => {
  const h = harness();
  const route = load('app/api/lead-extractor/route.ts', {
    'next/server': next, '@/auth': auth, '@/lib/db': { db: h.db }, '@/lib/result-credits': h.credit,
    '@/lib/rate-limit': rateLimit, '@/lib/owner': { isOwner: () => false },
    '@/lib/brave': { braveSearch: async () => [] },
    '@/lib/apify': { startRunAndWait: async () => 'run', getDatasetItems: async () => [] },
    '@/lib/claude': {},
  }, { fetch: async () => { throw new Error('unreachable'); } });
  const response = await route.POST(request('/api/lead-extractor', { accounts: ['https://www.instagram.com/example'] }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).creditsUsed, 0);
  assert.equal(h.state().credits, 100);
});
function slideRoute(h, output, images = []) {
  let generated = 0;
  return load('app/api/slideshow/generate/route.ts', {
    'next/server': next, '@/auth': auth, '@/lib/db': { db: h.db }, '@/lib/result-credits': h.credit,
    '@/lib/rate-limit': rateLimit,
    '@/lib/openai': { generateLogoImage: async () => {
      const result = images[generated++];
      if (!result) throw new Error('image provider failed');
      return result;
    } },
    '@/lib/claude': { CLAUDE_MODELS: { fast: 'mock' }, claude: () => ({ messages: { create: async () => json(output) } }) },
  });
}
test('slideshow own-image fallback placeholders cost zero', async () => {
  const h = harness();
  const response = await slideRoute(h, {}).POST(request('/api/slideshow/generate', { description: 'Presentation', images: ['data:image/png;base64,YQ=='] }));
  assert.equal(response.status, 502);
  assert.equal(h.state().credits, 100);
});
test('slideshow charges only completed images in a partial batch', async () => {
  const h = harness();
  const slides = [1, 2].map(n => ({ title: `Slide ${n}`, subtitle: 'Valid text', backgroundDesc: 'Blue texture' }));
  const response = await slideRoute(h, slides, ['data:image/png;base64,YQ==', '']).POST(request('/api/slideshow/generate', { description: 'Presentation', slideCount: 2 }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).creditsUsed, 15);
  assert.equal(h.state().credits, 85);
});
for (const [label, fetchResponse] of [['HTTP error', new Response('Server error', { status: 500 })], ['empty page', new Response('  ')], ['unreachable', null]]) {
  test(`Competitor Watch ${label} costs zero and preserves baseline`, async () => {
    const h = harness();
    h.db.competitorWatch = { findUnique: async () => ({ id: 'c', userId: 'u', links: [{ url: 'https://example.org', lastHash: 'old-baseline' }] }) };
    const route = load('app/api/competitor-watch/[id]/scan/route.ts', {
      'next/server': next, '@/auth': auth, '@/lib/db': { db: h.db }, '@/lib/result-credits': h.credit,
    }, { fetch: async () => { if (!fetchResponse) throw new Error('offline'); return fetchResponse.clone(); } });
    const response = await route.POST(request('/api/competitor-watch/c/scan', {}), params);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).creditsUsed, 0);
    assert.equal(h.state().credits, 100);
  });
}
