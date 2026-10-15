const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertStagingDatabase, assertStagingEnvironment } = require('./staging-guard.cjs');
const { load } = require('./test-module-loader.cjs');
function env() {
  return { FORTIFY_ENV: 'staging', RAILWAY_PROJECT_ID: '391c5fb1-9290-43f1-8b37-0ebdc7c7bb85',
    DATABASE_URL: 'postgresql://test:inert@postgres.railway.internal:5432/fortify_staging',
    DIRECT_URL: 'postgresql://test:inert@postgres.railway.internal:5432/fortify_staging',
    AUTH_URL: 'https://staging-example.up.railway.app', AUTH_SECRET: 'inert-test-value-with-32-characters',
    DISCORD_CLIENT_ID: 'inert', DISCORD_CLIENT_SECRET: 'inert', STAGING_TEST_DISCORD_ID: 'inert', GROQ_API_KEY: 'inert' };
}
test('staging accepts only the isolated project and private staging database', () => {
  assert.doesNotThrow(() => assertStagingEnvironment(env()));
  for (const patch of [{ RAILWAY_PROJECT_ID: 'production' }, { DATABASE_URL: 'postgresql://test:inert@production.example.com/fortify_staging' },
    { DIRECT_URL: 'postgresql://test:inert@postgres.railway.internal/production' }, { DATABASE_URL: 'invalid' }]) {
    assert.throws(() => assertStagingEnvironment({ ...env(), ...patch }));
  }
});
test('bootstrap fails closed without required credentials or a dedicated auth origin', () => {
  for (const key of ['FORTIFY_ENV','AUTH_SECRET','DISCORD_CLIENT_SECRET','STAGING_TEST_DISCORD_ID','GROQ_API_KEY']) {
    assert.throws(() => assertStagingEnvironment({ ...env(), [key]: '' }));
  }
  for (const AUTH_URL of ['https://fortify-io.com', 'http://staging-example.up.railway.app', 'https://user:pass@staging-example.up.railway.app']) {
    assert.throws(() => assertStagingEnvironment({ ...env(), AUTH_URL }));
  }
});
test('staging refuses messaging, payment, scheduler and storage credentials', () => {
  for (const key of ['DISCORD_BOT_TOKEN','RESEND_API_KEY','STRIPE_SECRET_KEY','PAYPAL_CLIENT_SECRET','CRON_SECRET','SMTP_PASSWORD','AWS_SECRET_ACCESS_KEY',
    'WHOP_APP_API_KEY','WHOP_CLIENT_SECRET','OUTBOUND_SMTP_PASS','OUTBOUND_IMAP_PASS','R2_SECRET_ACCESS_KEY','BOT_INTERNAL_KEY','TWITTER_ACCESS_TOKEN','TIKTOK_CLIENT_SECRET']) {
    assert.throws(() => assertStagingEnvironment({ ...env(), [key]: 'inert' }));
  }
});
test('an unsafe staging database is rejected before constructing Prisma', () => {
  let calls = 0;
  assert.throws(() => load('lib/db.ts', {
    '@prisma/client': { PrismaClient: class { constructor() { calls++; } } },
    '@/scripts/staging-guard.cjs': { assertStagingDatabase: () => assertStagingDatabase({ ...env(), DATABASE_URL: 'postgresql://x:y@prod.example.com/prod' }) },
  }));
  assert.equal(calls, 0);
});
test('staging requests to scheduled jobs and integrations stop before handlers', () => {
  // NextResponse is constructed by the middleware for rejected routes.
  const mod = load('middleware.ts', { 'next/server': { NextResponse: class extends Response { static next() { return new Response(null); } } } }, { process: { env: { FORTIFY_ENV: 'staging' } } });
  for (const path of ['/api/cron/outbound-tick','/api/paypal/create-order','/api/outbound/send','/api/whop/webhook']) {
    assert.equal(mod.middleware({ nextUrl: { pathname: path } }).status, 404);
  }
  const allowed = mod.middleware({ nextUrl: { pathname: '/api/ai/hook' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
});
function authConfig(environment) {
  let config;
  load('auth.ts', {
    'next-auth': { default: c => { config = c; return {}; } },
    'next-auth/providers/discord': { default: c => c },
    '@auth/prisma-adapter': { PrismaAdapter: () => ({}) },
    '@/lib/db': { db: {} }, '@/lib/tiers': { TIER_LIMITS: {} },
  }, { process: { env: environment } });
  return config;
}
test('staging permits only the configured Discord account and fails closed without one', async () => {
  const config = authConfig({ FORTIFY_ENV: 'staging', STAGING_TEST_DISCORD_ID: 'test-owner' });
  assert.equal(await config.callbacks.signIn({ account: { provider: 'discord', providerAccountId: 'test-owner' } }), true);
  for (const account of [null, { provider: 'discord', providerAccountId: 'someone-else' }, { provider: 'other', providerAccountId: 'test-owner' }]) {
    assert.equal(await config.callbacks.signIn({ account }), false);
  }
  const missing = authConfig({ FORTIFY_ENV: 'staging' });
  assert.equal(await missing.callbacks.signIn({ account: { provider: 'discord', providerAccountId: 'test-owner' } }), false);
});
test('normal production auth is not restricted by staging admission policy', async () => {
  assert.equal(await authConfig({}).callbacks.signIn({ account: { provider: 'discord', providerAccountId: 'customer' } }), true);
});
