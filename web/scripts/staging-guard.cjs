const STAGING_PROJECT = '391c5fb1-9290-43f1-8b37-0ebdc7c7bb85';

function assertStagingDatabase(env = process.env) {
  if (env.FORTIFY_ENV !== 'staging') return;
  if (env.RAILWAY_PROJECT_ID !== STAGING_PROJECT) throw new Error('Staging project identity mismatch');
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    let url;
    try { url = new URL(env[key]); } catch { throw new Error(`Staging ${key} is required`); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
        !url.hostname.endsWith('.railway.internal') || url.pathname !== '/fortify_staging') {
      throw new Error(`Staging ${key} must reference the private staging database`);
    }
  }
}

function assertStagingEnvironment(env = process.env) {
  if (env.FORTIFY_ENV !== 'staging') throw new Error('This command is staging only');
  assertStagingDatabase(env);
  for (const key of ['AUTH_URL', 'AUTH_SECRET', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'STAGING_TEST_DISCORD_ID', 'GROQ_API_KEY']) {
    if (!env[key]?.trim()) throw new Error(`Staging ${key} is required`);
  }
  if (env.AUTH_SECRET.length < 32) throw new Error('Staging AUTH_SECRET must have at least 32 characters');
  const auth = new URL(env.AUTH_URL);
  if (auth.protocol !== 'https:' || !auth.hostname.endsWith('.up.railway.app') || auth.username || auth.password || auth.search || auth.hash) {
    throw new Error('Staging AUTH_URL must use its Railway HTTPS domain');
  }
  // Anything that can message, charge, publish, store media or reach the production bot.
  const forbidden = /^(DISCORD_BOT_TOKEN|BOT_INTERNAL_.*|RESEND_.*|CRON_SECRET|WHOP_.*|STRIPE_.*|PAYPAL_.*|SMTP_.*|IMAP_.*|OUTBOUND_.*(PASS|SECRET|USER|HOST)|S3_.*|AWS_.*|R2_.*|TWITTER_.*|TIKTOK_.*|META_APP_SECRET|FACEBOOK_APP_SECRET|GOOGLE_CLIENT_SECRET|NOTION_.*(SECRET|TOKEN))$/;
  for (const key of Object.keys(env)) {
    if (forbidden.test(key) && env[key]) throw new Error(`Remove external-action credential from staging: ${key}`);
  }
}
module.exports = { assertStagingDatabase, assertStagingEnvironment };
