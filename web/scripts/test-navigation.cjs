const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./test-module-loader.cjs');
const root = path.resolve(__dirname, '..');

test('persistent navigation follows tool, nested and query-selected workspace routes', () => {
  const { workspaceActiveKey } = load(path.join(root, 'lib/tools.ts'), { 'lucide-react': {} });
  for (const [url, view, key] of [
    ['/dashboard', null, 'dashboard'], ['/dashboard/content', 'research', 'inspiration'],
    ['/dashboard/content', 'story', 'story'], ['/dashboard/content', 'test', 'virality'],
    ['/dashboard/decisions/archive', null, 'advisor'], ['/dashboard/plans/a-plan', null, 'plans'],
    ['/dashboard/workflows/a-workflow', null, 'workflows'], ['/dashboard/competitor-tracking', null, 'competitor-watch'],
    ['/dashboard/forums/a-forum', null, 'forums'], ['/dashboard/settings', null, 'settings'],
  ]) assert.equal(workspaceActiveKey(url, view), key);
});

test('only navigation fields cross the persistent client boundary', () => {
  const { workspaceMember } = load(path.join(root, 'lib/workspace-member.ts'));
  const member = { email: 'member@example.test', username: 'member', tier: 'PRO', discordId: 'member', credits: 500 };
  const serialized = JSON.parse(JSON.stringify(workspaceMember({ ...member, whopUserId: 'private', accounts: [{ access_token: 'private' }], subscription: { paypalSubId: 'private' } })));
  assert.deepEqual(serialized, member);
});

test('shared announcements are cached, expired messages are filtered at read time, and invalidation refreshes edits', async () => {
  let now = 1000, reads = 0, cached;
  const state = [{ id: 'a', message: 'Hello', expiresAt: new Date(2000) }];
  class Clock extends Date { static now() { return now; } }
  const { getAnnouncements, invalidateAnnouncements } = load(path.join(root, 'lib/announcements.ts'), {
    '@/lib/db': { db: { announcement: { findMany: async () => { reads++; return structuredClone(state); } } } },
    'next/cache': {
      unstable_cache: (fn, keys, options) => {
        assert.equal(options.revalidate, 30);
        assert.deepEqual(Array.from(options.tags), ['announcements']);
        return async () => cached ??= await fn();
      },
      revalidateTag: tag => { assert.equal(tag, 'announcements'); cached = undefined; },
    },
  }, { Date: Clock });
  assert.equal((await getAnnouncements())[0].message, 'Hello');
  assert.equal((await getAnnouncements()).length, 1);
  assert.equal(reads, 1);
  now = 2500;
  assert.equal((await getAnnouncements()).length, 0);
  assert.equal(reads, 1);
  state.push({ id: 'b', message: 'New message', expiresAt: null });
  invalidateAnnouncements();
  assert.equal((await getAnnouncements())[0].message, 'New message');
  assert.equal(reads, 2);
});

test('announcement polling stays authenticated and never caches a member response', async () => {
  let signedIn = false, reads = 0;
  const { GET } = load(path.join(root, 'app/api/announcements/route.ts'), {
    '@/auth': { auth: async () => signedIn ? { user: { id: 'member' } } : null },
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/announcements': { getAnnouncements: async () => { reads++; return []; } },
  });
  assert.equal((await GET()).status, 401); assert.equal(reads, 0);
  signedIn = true;
  const response = await GET();
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(reads, 1);
});
