const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { load } = require('./test-module-loader.cjs');
const starters = load('lib/workflow-starters.ts');
const schedule = load('lib/workflow-schedule.ts', { '@/lib/workflow-starters': starters });
const diff = load('lib/competitor-diff.ts');

test('page comparison ignores scripts, navigation, cookie banners and footer churn', () => {
  const page = suffix => `<html><body><nav>Menu ${suffix}</nav><main><h1>Pricing</h1><p>Our professional plan is £79 per month.</p></main><script>${suffix}</script><footer>${suffix}</footer><div class="cookie">${suffix}</div></body></html>`;
  const first = diff.meaningfulPageText(page('yesterday')), second = diff.meaningfulPageText(page('today'));
  assert.equal(first, second); assert.equal(diff.comparePage(first, second).status, 'unchanged');
});
test('price change has exact before/after evidence and a conservative implication', () => {
  const report = diff.comparePage('Professional plan: £79 per month', 'Professional plan: £89 per month');
  assert.equal(report.status, 'changed'); assert.equal(report.evidence.category, 'pricing or offer');
  assert.match(report.summary, /£79/); assert.match(report.summary, /£89/); assert.match(report.evidence.whyItMatters, /no business impact has been measured/);
  assert.equal(diff.comparePage(undefined, 'A first readable page').status, 'baseline');
});
test('reordered content does not create a false change', () => assert.equal(diff.comparePage('One offer\nAnother offer', 'Another offer\nOne offer').status, 'unchanged'));

test('minute schedules support half-hours, bounded catch-up and no old replay', () => {
  assert.equal(schedule.latestScheduleSlot('30 9 * * *', new Date('2026-10-12T08:32:10Z'), 'Europe/London').scheduledAt.toISOString(), '2026-10-12T08:30:00.000Z');
  assert.equal(schedule.latestScheduleSlot('30 9 * * *', new Date('2026-10-12T08:36:00Z'), 'Europe/London'), null);
  assert.equal(schedule.scheduleMatches('*/0 * * * *', new Date()), false);
});
test('cron day-of-month and weekday use standard OR semantics', () => {
  assert.equal(schedule.scheduleMatches('0 9 1 * 1', new Date('2026-10-12T09:00:00Z')), true);
  assert.equal(schedule.scheduleMatches('0 9 1 * 1', new Date('2026-11-01T09:00:00Z')), true);
  assert.equal(schedule.scheduleMatches('0 9 1 * 1', new Date('2026-10-13T09:00:00Z')), false);
});
test('calendar step expressions start at valid field minimums', () => {
  assert.equal(schedule.scheduleMatches('0 9 */2 */2 *', new Date('2026-01-01T09:00:00Z')), true);
  assert.equal(schedule.scheduleMatches('0 9 */2 */2 *', new Date('2026-02-02T09:00:00Z')), false);
});
test('UK daylight-saving repeated hour uses one wall-clock run key', () => {
  const first = schedule.latestScheduleSlot('30 1 * * *', new Date('2026-10-25T00:30:00Z'), 'Europe/London');
  const second = schedule.latestScheduleSlot('30 1 * * *', new Date('2026-10-25T01:30:00Z'), 'Europe/London');
  assert.equal(first.wallKey, second.wallKey); assert.notEqual(first.scheduledAt.toISOString(), second.scheduledAt.toISOString());
});

const publicPage = load('lib/public-page.ts');
test('private, local, metadata, mapped IPv4 and reserved addresses are rejected', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '172.16.0.1', '::1', 'fc00::1', '::ffff:127.0.0.1', '0.0.0.0']) assert.equal(publicPage.publicAddress(address), false, address);
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(publicPage.publicAddress(address), true, address);
  for (const url of ['http://localhost/a', 'http://127.1/a', 'http://user:password@example.com/', 'https://example.com:1234/']) assert.throws(() => publicPage.publicPageUrl(url));
});
test('public fetch pins the approved address and rejects private redirects', async () => {
  let requests = 0, pinned;
  const fakeRequest = (url, options, cb) => {
    requests++; options.lookup('agency.test', {}, (_error, address) => { pinned = address; });
    const req = new EventEmitter(); req.destroy = error => req.emit('error', error);
    req.end = () => setImmediate(() => { const res = new EventEmitter(); res.statusCode = 302; res.headers = { location: 'http://127.0.0.1/secret' }; cb(res); res.emit('end'); req.emit('close'); });
    return req;
  };
  const api = load('lib/public-page.ts', { 'node:dns/promises': { lookup: async () => [{ address: '8.8.8.8', family: 4 }] }, 'node:https': { request: fakeRequest }, 'node:http': { request: fakeRequest } });
  await assert.rejects(api.readPublicPage('https://agency.test/'), /public/); assert.equal(requests, 1); assert.equal(pinned, '8.8.8.8');
});

const verification = load('lib/contact-verification.ts');
const verifiedAt = new Date('2026-10-12T09:00:00Z');
const valid = { email: 'owner@agency.test', status: 'valid', smtp_check: true, accept_all: false, verification: { date: '2026-10-11' } };
test('mailbox validity requires matched address, a recent check and successful non-catch-all SMTP result', () => {
  assert.equal(verification.mailboxVerdict(valid, valid.email, verifiedAt).status, 'deliverable');
  for (const override of [{ email: 'another@agency.test' }, { smtp_check: false }, { verification: null }, { verification: { date: '2026-01-01' } }, { block: true }]) assert.equal(verification.mailboxVerdict({ ...valid, ...override }, valid.email, verifiedAt).status, 'unknown');
  assert.equal(verification.mailboxVerdict({ ...valid, accept_all: true }, valid.email, verifiedAt).status, 'catch_all');
  assert.equal(verification.mailboxVerdict({ ...valid, disposable: true }, valid.email, verifiedAt).status, 'disposable');
});
test('email validation rejects header injection and malformed addresses', () => {
  for (const email of ['hello', 'a@localhost', 'a..b@example.com', 'a@example.com\nBcc: other@example.com']) assert.equal(verification.normaliseEmail(email), null);
  assert.equal(verification.normaliseEmail(' Owner@Example.com '), 'owner@example.com');
});
test('MX-only checks never claim a verified mailbox or call an unconfigured provider', async () => {
  const api = load('lib/contact-verification.ts', { 'node:dns/promises': { resolveMx: async () => [{ exchange: 'mx.agency.test', priority: 10 }] } }, { fetch: () => { throw new Error('Provider must not run'); }, process: { env: { HUNTER_API_KEY: 'not-activated' } } });
  assert.equal((await api.verifyContact('owner@agency.test')).status, 'domain_only');
});
test('null-MX is invalid while transient DNS failure remains unknown', async () => {
  const nullMx = load('lib/contact-verification.ts', { 'node:dns/promises': { resolveMx: async () => [{ exchange: '', priority: 0 }] } });
  assert.equal((await nullMx.verifyContact('owner@agency.test')).status, 'invalid');
  const unavailable = load('lib/contact-verification.ts', { 'node:dns/promises': { resolveMx: async () => { throw Object.assign(new Error('Unavailable'), { code: 'ESERVFAIL' }); } } });
  assert.equal((await unavailable.verifyContact('owner@agency.test')).status, 'unknown');
});
test('provider pending, restrictions and outages stay unsendable', async () => {
  for (const [httpStatus, status] of [[202, 'pending'], [451, 'restricted'], [429, 'unknown']]) {
    const api = load('lib/contact-verification.ts', { 'node:dns/promises': { resolveMx: async () => [{ exchange: 'mx.agency.test', priority: 10 }] } }, {
      process: { env: { HUNTER_API_KEY: 'private-test-key', EMAIL_VERIFICATION_ENABLED: 'true' } },
      fetch: async (url, options) => { assert.equal(url.includes('private-test-key'), false); assert.equal(options.headers['X-API-KEY'], 'private-test-key'); return new Response('', { status: httpStatus }); },
    }); assert.equal((await api.verifyContact('owner@agency.test')).status, status);
  }
});

function claimFixture() {
  const runs = []; let chain = Promise.resolve();
  const tx = { $queryRaw: async () => [{ id: 'u1' }], workflowRun: { findUnique: async ({ where }) => runs.find(run => run.idempotencyKey === where.idempotencyKey), create: async ({ data }) => { const run = { id: `run${runs.length}`, ...data }; runs.push(run); return run; } } };
  const db = { $transaction: fn => { const current = chain.then(() => fn(tx)); chain = current.catch(() => {}); return current; } };
  const api = load('lib/workflow-run-claim.ts', { '@/lib/db': { db }, '@/lib/workflow-capacity': { getCapacityInfo: async (_id, _tier, client) => { assert.equal(client, tx); return { isUnlimited: false, remaining: 100 - runs.length * 100 }; } } });
  return { api, runs };
}
test('overlapping scheduler calls claim a single run and charge capacity once', async () => {
  const f = claimFixture(); const result = await Promise.all([f.api.claimWorkflowRun('wf1', 'u1', 'ELITE', { idempotencyKey: 'same-slot' }), f.api.claimWorkflowRun('wf1', 'u1', 'ELITE', { idempotencyKey: 'same-slot' })]);
  assert.equal(f.runs.length, 1); assert.equal(result.filter(item => item.existing).length, 1);
});
test('capacity reservation stops a second independent run when the allowance is exhausted', async () => {
  const f = claimFixture(); await f.api.claimWorkflowRun('wf1', 'u1', 'ELITE', { idempotencyKey: 'first' });
  assert.equal((await f.api.claimWorkflowRun('wf1', 'u1', 'ELITE', { idempotencyKey: 'second' })).run, null); assert.equal(f.runs.length, 1);
});
test('delivery retry policy permits idempotent email and reads, but not arbitrary mutations', () => {
  const policy = load('lib/workflow-retry.ts');
  assert.equal(policy.retrySafe('action_email', {}), true); assert.equal(policy.retrySafe('action_http_request', { method: 'GET' }), true);
  for (const kind of ['action_discord', 'action_slack', 'action_notion', 'action_shopify', 'action_twitter']) assert.equal(policy.retrySafe(kind, {}), false);
  assert.equal(policy.retrySafe('action_http_request', { method: 'POST' }), false); assert.equal(policy.retryCount('999'), 3); assert.equal(policy.retryCount('bad'), 0);
});

test('client context has strict owner lookup and cannot fall back to the account voice', async () => {
  let voiceLookups = 0;
  const api = load('lib/client-context.ts', { '@/lib/business-context': load('lib/business-context.ts'), '@/lib/db': { db: {
    clientWorkspace: { findFirst: async ({ where }) => where.userId === 'owner' && where.id === 'client' ? { name: 'Client A', entries: [{ content: 'Only Client A facts' }], brandVoiceId: null } : null },
    brandVoice: { findFirst: async () => { voiceLookups++; return { name: 'Personal voice' }; } },
  } } });
  const result = await api.clientContext('owner', 'client'); assert.equal(result.voice, null); assert.equal(voiceLookups, 0); assert.match(result.businessContext, /Only Client A facts/);
  await assert.rejects(api.clientContext('other', 'client'), /unavailable/);
});

function watchFixture({ fail = false, changed = false } = {}) {
  let lease = null, charged = 0, refunded = 0, links;
  const scans = [], notices = [];
  const text = 'Our professional plan is £79 per month. '.repeat(5);
  const before = diff.meaningfulPageText(`<main><p>${text}</p></main>`);
  const watch = { id: 'watch', userId: 'owner', name: 'Rival', user: { tier: 'ELITE', discordId: null }, links: [{ id: 'p1', url: 'https://rival.test/', label: 'Pricing', type: 'page', lastContent: before }] };
  const model = { findFirst: async () => watch, updateMany: async ({ where, data }) => {
    if (data.scanLeaseUntil) { if (lease) return { count: 0 }; lease = data.scanLeaseUntil; return { count: 1 }; }
    if (lease?.getTime() === where.scanLeaseUntil.getTime()) lease = null; return { count: 1 };
  }, update: async ({ data }) => { links = data.links; } };
  const tx = { competitorWatch: model, competitorWatchScan: { create: async ({ data }) => { const scan = { id: `scan${scans.length}`, ...data }; scans.push(scan); return scan; } } };
  const api = load('lib/competitor-watch-scan.ts', {
    '@/lib/db': { db: { ...tx, $transaction: async fn => fn(tx), notification: { create: async value => notices.push(value) } } },
    '@/lib/public-page': { readPublicPage: async () => { if (fail) throw new Error('HTTP 404'); return { url: 'https://rival.test/', html: `<main><p>${changed ? text.replaceAll('£79', '£89') : text}</p></main>` }; } },
    '@/lib/competitor-diff': diff,
    '@/lib/credit-reservation': { reserveCredits: async () => { charged++; return { id: 'debit' }; }, refundCredits: async () => { refunded++; } },
    '@/lib/notifications': { sendDMConditional: async () => {} },
  });
  return { api, scans, notices, charged: () => charged, refunded: () => refunded, links: () => links, before };
}
test('concurrent watch scans reserve and scan once', async () => {
  const f = watchFixture(); const results = await Promise.all([f.api.scanWatch('watch', 'owner'), f.api.scanWatch('watch', 'owner')]);
  assert.equal(f.charged(), 1); assert.equal(f.scans.length, 1); assert.equal(results.filter(result => result.skipped).length, 1);
});
test('failed page fetch preserves baseline, records failure and refunds scan credits', async () => {
  const f = watchFixture({ fail: true }); const result = await f.api.scanWatch('watch', 'owner');
  assert.equal(result.creditsUsed, 0); assert.equal(f.refunded(), 1); assert.equal(f.scans[0].status, 'failed'); assert.equal(f.links()[0].lastContent, f.before); assert.equal(f.notices.length, 0);
});
test('observed price changes persist evidence and create a useful alert', async () => {
  const f = watchFixture({ changed: true }); const result = await f.api.scanWatch('watch', 'owner');
  assert.equal(result.creditsUsed, 10); assert.equal(f.scans[0].status, 'changed'); assert.match(f.scans[0].summary, /£89/); assert.equal(f.scans[0].evidence.sourceUrl, 'https://rival.test/'); assert.equal(f.notices.length, 1);
});

test('outbound gate blocks unknown, stale, catch-all and other-account verification before claiming delivery', async () => {
  for (const contact of [null, { status: 'unknown', provider: 'hunter', expiresAt: new Date(Date.now() + 60000) }, { status: 'catch_all', provider: 'hunter', expiresAt: new Date(Date.now() + 60000) }, { status: 'deliverable', provider: 'hunter', expiresAt: new Date(0) }, { status: 'deliverable', provider: 'dns', expiresAt: new Date(Date.now() + 60000) }]) {
    let claims = 0;
    const api = load('lib/outbound/engine/send.ts', {
      '@/lib/db': { db: { contactCheck: { findUnique: async ({ where }) => { assert.deepEqual(JSON.parse(JSON.stringify(where)), { userId_email: { userId: 'owner', email: 'owner@agency.test' } }); return contact; } }, outboundEmail: { update: async () => {}, updateMany: async () => { claims++; return { count: 1 }; } } } },
      '@/lib/outbound/registry': { getSendProvider: () => { throw new Error('Must not send'); } },
      './shared': { isSendableEmail: () => true, isSuppressed: async () => false, logEvent: async () => {} },
    });
    const result = await api.sendEmail({ id: 'email' }, { id: 'lead', email: 'owner@agency.test', userId: 'owner', domain: 'agency.test' }, { senderEmail: 'sender@fortify.test' });
    assert.equal(result.sent, false); assert.equal(result.reason, 'mailbox not verified'); assert.equal(claims, 0);
  }
});

test('competitor scheduler keeps owner and client context boundaries and reports returned failures', async () => {
  const fired = [];
  const api = load('app/api/cron/run-scheduled-workflows/route.ts', {
    'next/server': { NextResponse: class extends Response { static json(data) { return new Response(JSON.stringify(data)); } } },
    '@/lib/db': { db: {
      workflowRun: { updateMany: async () => ({ count: 0 }), findMany: async () => [] },
      workflow: { findMany: async () => [{ id: 'wf', userId: 'owner', clientWorkspaceId: 'client-a', nodes: { nodes: [{ type: 'trigger_competitor', config: {} }] } }] },
      competitorWatchScan: { findMany: async () => [
        { id: 'wrong-owner', watch: { userId: 'other', clientWorkspaceId: 'client-a' }, evidence: { added: [], removed: [] } },
        { id: 'wrong-client', watch: { userId: 'owner', clientWorkspaceId: 'client-b' }, evidence: { added: [], removed: [] } },
        { id: 'matching', watch: { userId: 'owner', clientWorkspaceId: 'client-a', name: 'Rival' }, summary: 'Price update', evidence: { added: ['£89'], removed: ['£79'] } },
      ] },
    } },
    '@/lib/workflow-runner': { runWorkflow: async (...args) => { fired.push(args); return { runId: 'run', status: 'failed' }; } },
    '@/lib/workflow-schedule': { latestScheduleSlot: () => null },
  }, { process: { env: { CRON_SECRET: 'local-test-secret' } } });
  const result = await api.POST(new Request('https://fortify.test/cron', { method: 'POST', headers: { 'x-cron-secret': 'local-test-secret' } }));
  const body = await result.json(); assert.equal(fired.length, 1); assert.equal(fired[0][2].idempotencyKey, 'workflow:wf:scan:matching');
  assert.equal(body.ok, false); assert.equal(body.errors, 1); assert.equal(body.fired, 0);
});
