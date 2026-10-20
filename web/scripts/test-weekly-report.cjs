const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./test-module-loader.cjs');

function service({ optedOut = [], failFor = [] } = {}) {
  const generated = [], delivered = [];
  const members = [
    ['free', 'FREE', 'discord-free'],
    ['pro', 'PRO', 'discord-pro'],
    ['elite', 'ELITE', 'discord-elite'],
    ['apex', 'APEX', 'discord-apex'],
    ['unlinked', 'ELITE', null],
  ].map(([id, tier, discordId]) => ({ id, name: id, tier, discordId,
    generations: [], brandVoices: [], competitors: [], watchTerms: [] }));
  let reads = 0;
  const db = {
    user: { findMany: async ({ where }) => {
      reads++;
      return members.filter(user => where.tier.in.includes(user.tier) && user.discordId !== where.discordId.not);
    } },
    notificationPrefs: { findUnique: async ({ where }) => ({ dmWeeklyReport: !optedOut.includes(where.userId) }) },
  };
  const notifications = load('lib/notifications.ts', {
    '@/lib/db': { db },
    '@/lib/discord': { sendDM: async (discordId, content) => delivered.push({ discordId, content }) },
  });
  const route = load('app/api/cron/weekly-report/route.ts', {
    'next/server': { NextResponse: class extends Response { static json(data, init) { return Response.json(data, init); } } },
    '@/lib/db': { db },
    '@/lib/notifications': notifications,
    '@/lib/claude': { CLAUDE_MODELS: { fast: 'test-model' }, claude: () => ({ messages: { create: async params => {
      const prompt = params.messages[0].content;
      generated.push(prompt);
      if (failFor.some(id => prompt.includes(`named ${id}.`))) throw new Error('Provider unavailable');
      return { content: [{ type: 'text', text: 'A supported strategy report.' }] };
    } } }) },
  }, { process: { env: { CRON_SECRET: 'inert-test-secret' } } });
  const post = secret => route.POST(new Request('https://fortify.test/api/cron/weekly-report', {
    method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {},
  }));
  return { post, generated, delivered, reads: () => reads };
}

test('weekly strategy reports generate and deliver only for linked Elite and Apex members', async () => {
  const api = service();
  const result = await api.post('inert-test-secret');
  assert.equal(result.status, 200);
  assert.equal(api.generated.length, 2);
  assert.match(api.generated[0], /ELITE member named elite/);
  assert.match(api.generated[1], /APEX member named apex/);
  assert.deepEqual(api.delivered.map(dm => dm.discordId), ['discord-elite', 'discord-apex']);
  assert.deepEqual(await result.json(), { ok: true, sent: 2 });
});

test('the existing weekly-report opt-out still suppresses Discord delivery', async () => {
  const api = service({ optedOut: ['elite'] });
  assert.equal((await api.post('inert-test-secret')).status, 200);
  assert.deepEqual(api.delivered.map(dm => dm.discordId), ['discord-apex']);
});

test('an unauthorized cron request cannot read members, generate reports or send DMs', async () => {
  const api = service();
  for (const secret of [undefined, 'incorrect-secret']) {
    assert.equal((await api.post(secret)).status, 401);
  }
  assert.equal(api.reads(), 0);
  assert.equal(api.generated.length, 0);
  assert.equal(api.delivered.length, 0);
});

test('a provider failure skips that member and continues with the next eligible member', async () => {
  const api = service({ failFor: ['elite'] });
  assert.equal((await api.post('inert-test-secret')).status, 200);
  assert.deepEqual(api.delivered.map(dm => dm.discordId), ['discord-apex']);
});
