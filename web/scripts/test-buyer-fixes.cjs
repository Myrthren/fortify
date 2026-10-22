const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');
const offer = load('lib/outbound/offer.ts');
const signals = { hasSsl: true, hasContactForm: false, hasBookingWidget: false, hasLiveChat: false, hasChatbot: false,
  hasNewsletterCapture: false, hasPhoneNumber: false, hasMobileViewport: true, hasMetaDescription: true,
  titleLength: 20, h1Count: 1, htmlBytes: 500, fetchMs: 10, emails: [], socialLinks: [],
  detectedBooking: [], detectedChat: [], detectedCrm: [], detectedAnalytics: [], detectedEmailMarketing: [], detectedEcommerce: [] };
const input = { company: 'Shop', website: 'https://example.org', offer: 'We provide product photography for skincare shops.',
  site: { finalUrl: 'https://example.org', pages: [{ url: 'https://example.org' }], text: 'Our skincare collection launches in November.', signals } };
const opportunity = { title: 'Launch images', evidence: input.site.text, fortifyService: 'product photography', score: 80, impact: 'medium' };
function analyser(output = {}) {
  const calls = [];
  const mod = load('lib/outbound/providers/analysis/claude.ts', {
    '@/lib/outbound/offer': offer,
    '@/lib/claude': { CLAUDE_MODELS: { fast: 'test' }, claude: () => ({ messages: { create: async request => {
      calls.push(request); return { content: [{ type: 'text', text: JSON.stringify({ analysis: {}, opportunities: [opportunity], opportunityScore: 80, ...output }) }] };
    } } }) }, '@/lib/outbound/types': { ANALYSIS_DIMENSIONS: ['websiteQuality'] },
  });
  return { ...mod, calls };
}
test('analysis follows customer offer and retains sourced opportunities', async () => {
  const api = analyser(); const result = await api.claudeAnalysis.analyse(input);
  assert.equal(result.opportunities.length, 1); assert.equal(result.suggestedService, 'product photography');
  assert.match(api.calls[0].system, /customer is the seller/);
  assert.doesNotMatch(api.calls[0].system, /business-systems agency|Fortify services you may map/);
  assert.match(api.calls[0].messages[0].content, /We provide product photography/);
  assert.match(api.calls[0].system, /missing signature only means not detected/);
});
test('no offer or website evidence prevents speculative analysis', async () => {
  const api = analyser();
  await assert.rejects(api.claudeAnalysis.analyse({ ...input, offer: ' ' }), /what you sell/);
  const result = await api.claudeAnalysis.analyse({ ...input, site: null });
  assert.equal(result.opportunityScore, 0); assert.ok(result.disqualify); assert.equal(api.calls.length, 0);
});
for (const [label, changed] of [['invented evidence', { evidence: 'Their images are poor quality' }], ['wrong offer', { fortifyService: 'Workflows' }], ['missing evidence', { evidence: '' }]]) {
  test(`${label} cannot become a scored opportunity`, async () => {
    const result = await analyser({ opportunities: [{ ...opportunity, ...changed }], suggestedService: 'Workflows' }).claudeAnalysis.analyse(input);
    assert.equal(result.opportunities.length, 0); assert.equal(result.opportunityScore, 0); assert.equal(result.suggestedService, ''); assert.ok(result.disqualify);
  });
}
test('zero confidence stays zero', async () => {
  const result = await analyser({ opportunities: [{ ...opportunity, score: 0 }], opportunityScore: 0 }).claudeAnalysis.analyse(input);
  assert.equal(result.opportunityScore, 0); assert.equal(result.opportunities[0].score, 0);
});
test('active campaign with no offer pauses before any pipeline activity', async () => {
  let updated; const fail = async () => { throw new Error('pipeline must not run'); };
  const mod = load('lib/outbound/engine/tick.ts', {
    '@/lib/outbound/offer': offer, '@/lib/db': { db: { outboundCampaign: { update: async ({ data }) => { updated = data; } } } },
    './discover': { runDiscovery: fail }, './send': { sendEmail: fail },
    './stages': { analyseLead: fail, draftEmail: fail, scrapeLead: fail }, './shared': {},
  });
  const result = await mod.tickCampaign({ id: 'c', name: 'Campaign', status: 'ACTIVE', offer: null }, { expired: false });
  assert.equal(updated.status, 'PAUSED'); assert.equal(result.sent, 0); assert.match(result.skippedSend, /offer/);
});

function watches({ fetch = async () => new Response('<main>Starter plan costs £29 per month.</main>', { headers: { 'content-type': 'text/html' } }), addresses = ['93.184.216.34'] } = {}) {
  let state = { credits: 100, receipts: {}, links: [], scans: [], version: 1 }, queue = Promise.resolve();
  const methods = get => ({
    creditTransaction: { findUnique: async ({ where }) => get().receipts[where.id] ?? null,
      create: async ({ data }) => { const id = data.id ?? `r${Object.keys(get().receipts).length}`; return get().receipts[id] = { ...data, id }; } },
    user: { updateMany: async ({ where, data }) => { if (get().credits < where.credits.gte) return { count: 0 }; get().credits -= data.credits.decrement; return { count: 1 }; } },
    competitorWatch: { updateMany: async ({ where, data }) => { if (where.updatedAt !== get().version) return { count: 0 }; get().links = structuredClone(data.links); get().version++; return { count: 1 }; } },
    competitorWatchScan: { create: async ({ data }) => { const scan = { ...data, id: `s${get().scans.length}`, scannedAt: new Date() }; get().scans.push(scan); return scan; } },
  });
  const db = methods(() => state);
  db.$transaction = fn => { const result = queue.then(async () => { const staged = structuredClone(state); const result = await fn(methods(() => staged)); state = staged; return result; }); queue = result.catch(() => {}); return result; };
  const credit = load('lib/result-credits.ts', { '@/lib/db': { db } });
  return { ...load('lib/competitor-watch.ts', { '@/lib/db': { db }, '@/lib/result-credits': credit,
    'dns/promises': { lookup: async () => addresses.map(address => ({ address })) } }, { fetch }), state: () => state };
}
const link = { id: 'link', url: 'https://example.org/pricing', label: 'Pricing', type: 'page' };
test('markup, script, navigation and timestamp changes do not alert', () => {
  const mod = watches();
  const before = mod.readableWatchText('<nav>Menu 1</nav><h1>Pricing</h1><p>£29 per month</p><script>nonce=1</script><time>Today</time>');
  const after = mod.readableWatchText('<nav>Menu 2</nav><div>Pricing</div><p>&pound;29 per month</p><script>nonce=2</script><time>Tomorrow</time>');
  assert.equal(before, after); const base = mod.compareWatchText(link, before);
  assert.equal(mod.compareWatchText(base.link, after).hasChange, false);
});
test('legacy hashes become baselines without fake changes', () => {
  const result = watches().compareWatchText({ ...link, lastHash: 'md5' }, 'Starter £29 per month');
  assert.equal(result.hasChange, false); assert.match(result.summary, /baseline saved/);
});
test('price changes show exact removed/added wording', () => {
  const mod = watches(); const base = mod.compareWatchText(link, 'Starter plan costs £29 per month.');
  const result = mod.compareWatchText(base.link, 'Starter plan costs £39 per month.');
  assert.equal(result.hasChange, true); assert.match(result.summary, /Removed: “£29”/); assert.match(result.summary, /Added: “£39”/);
});
test('new text shows its source wording without invented interpretation', () => {
  const mod = watches(); const base = mod.compareWatchText(link, 'Starter plan.');
  const result = mod.compareWatchText(base.link, 'Starter plan. Book a free demo.');
  assert.match(result.summary, /Added: “Book a free demo.”/); assert.doesNotMatch(result.summary, /Removed:/);
});
for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.16.0.1', '192.168.0.1', '::1', '::ffff:127.0.0.1']) {
  test(`private destination ${address} is not fetched`, async () => {
    let calls = 0; const mod = watches({ addresses: [address], fetch: async () => { calls++; return new Response('private'); } });
    await assert.rejects(mod.readWatchPage('https://example.org'), /public/); assert.equal(calls, 0);
  });
}
test('redirects are revalidated before fetching', async () => {
  let calls = 0; const mod = watches({ fetch: async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }); } });
  await assert.rejects(mod.readWatchPage('https://example.org'), /public/); assert.equal(calls, 1);
});
for (const [label, response] of [['HTTP error', new Response('failed', { status: 503 })], ['challenge', new Response('<html>Just a moment. Verify you are human.</html>', { headers: { 'content-type': 'text/html' } })], ['empty', new Response(' ', { headers: { 'content-type': 'text/html' } })]]) {
  test(`${label} preserves baseline and balance`, async () => {
    const mod = watches({ fetch: async () => response.clone() }); const base = mod.compareWatchText(link, 'Starter plan costs £29 per month.').link;
    const result = await mod.scanWatch({ id: 'w', userId: 'u', links: [base], updatedAt: 1 });
    assert.equal(result.creditsUsed, 0); assert.equal(result.scans[0].failed, true); assert.equal(mod.state().credits, 100); assert.equal(mod.state().scans.length, 0);
    assert.equal(base.lastText, 'Starter plan costs £29 per month.');
  });
}
test('daily scans persist evidence and bill only once', async () => {
  const mod = watches(); const watch = { id: 'w', userId: 'u', links: [link], updatedAt: 1 };
  assert.equal((await mod.scanWatch(watch, 'daily:w')).creditsUsed, 10); assert.match(mod.state().links[0].lastText, /£29/);
  assert.equal((await mod.scanWatch(watch, 'daily:w')).skipped, true); assert.equal(mod.state().credits, 90); assert.equal(mod.state().scans.length, 1);
});
test('overlapping scans cannot overwrite or charge a stale baseline', async () => {
  const mod = watches(); const watch = { id: 'w', userId: 'u', links: [link], updatedAt: 1 };
  const results = await Promise.allSettled([mod.scanWatch(watch), mod.scanWatch(watch)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(mod.state().credits, 90); assert.equal(mod.state().scans.length, 1);
});
const next = { NextResponse: class extends Response { static json(data, init) { return new this(JSON.stringify(data), init); } } };
test('activation needs an offer and accepts one supplied in the same edit', async () => {
  let writes = 0;
  const route = load('app/api/outbound/campaigns/[id]/route.ts', {
    'next/server': next, '@/auth': { auth: async () => ({ user: { id: 'u' } }) },
    '@/lib/db': { db: { outboundCampaign: {
      findFirst: async () => ({ id: 'c', status: 'DRAFT', offer: null }),
      update: async ({ data }) => { writes++; return data; },
    } } },
  });
  const request = body => new Request('https://fortify.test/api/outbound/campaigns/c', { method: 'PATCH', body: JSON.stringify(body) });
  assert.equal((await route.PATCH(request({ status: 'ACTIVE' }), { params: Promise.resolve({ id: 'c' }) })).status, 400);
  assert.equal(writes, 0);
  assert.equal((await route.PATCH(request({ status: 'ACTIVE', offer: input.offer }), { params: Promise.resolve({ id: 'c' }) })).status, 200);
  assert.equal(writes, 1);
});
test('a failed link in a partial scan keeps its old baseline', async () => {
  const mod = watches({ fetch: async target => target.pathname.includes('blocked') ? new Response('blocked', { status: 403 }) : new Response('<main>Starter plan costs £39 per month.</main>', { headers: { 'content-type': 'text/html' } }) });
  const failed = mod.compareWatchText({ ...link, id: 'blocked', url: 'https://example.org/blocked' }, 'Original text on the blocked page.').link;
  const valid = mod.compareWatchText(link, 'Starter plan costs £29 per month.').link;
  const result = await mod.scanWatch({ id: 'w', userId: 'u', links: [failed, valid], updatedAt: 1 });
  assert.equal(result.creditsUsed, 10);
  assert.equal(result.scans[0].failed, true);
  assert.equal(result.scans[1].hasChange, true);
  assert.equal(mod.state().links[0].lastText, failed.lastText);
  assert.match(mod.state().links[1].lastText, /£39/);
});
test('oversized responses cannot establish a truncated false baseline', async () => {
  const mod = watches({ fetch: async () => new Response('a'.repeat(2_000_001), { headers: { 'content-type': 'text/plain' } }) });
  await assert.rejects(mod.readWatchPage('https://example.org'), /size limit/);
});
for (const [label, campaignOffer, metadata] of [
  ['legacy draft', input.offer, {}],
  ['changed offer', 'We provide accounting services.', { offerFingerprint: offer.offerFingerprint(input.offer) }],
  ['missing offer', null, {}],
]) test(`${label} is held before any delivery provider is called`, async () => {
  let held, next;
  const mod = load('lib/outbound/engine/send.ts', {
    '@/lib/outbound/offer': offer,
    '@/lib/db': { db: { outboundEmail: { updateMany: async ({ data }) => { held = data; return { count: 1 }; } }, outboundLead: { update: async ({ data }) => { next = data; } } } },
    '@/lib/outbound/registry': { getSendProvider: () => { throw new Error('must not deliver'); } }, './shared': {},
  });
  const result = await mod.sendEmail({ id: 'e', variation: metadata }, { id: 'l' }, { offer: campaignOffer });
  assert.equal(result.sent, false); assert.equal(result.reason, 'offer review required');
  assert.equal(held.status, 'DRAFT'); assert.equal(next.nextActionAt, null);
});
test('explicit human approval records the current offer for the reviewed draft', async () => {
  let saved;
  const mod = load('lib/outbound/engine/tick.ts', {
    '@/lib/outbound/offer': offer,
    '@/lib/db': { db: {
      outboundEmail: { findUnique: async () => ({ id: 'e', leadId: 'l', subject: 'Reviewed', campaign: { offer: input.offer }, variation: {} }), update: async ({ data }) => { saved = data; } },
      outboundLead: { update: async () => {} },
    } },
    './discover': {}, './send': {}, './stages': {}, './shared': { logEvent: async () => {} },
  });
  await mod.queueApprovedEmail('e');
  assert.equal(saved.status, 'QUEUED');
  assert.equal(saved.variation.offerFingerprint, offer.offerFingerprint(input.offer));
});
