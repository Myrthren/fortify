// Opt-in hosted release checks. Secrets remain inside Netlify; no member prompts are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
let stage = 'startup';

async function main() {
  if (process.env.FORTIFY_VERIFY_AI_RELEASE !== 'true') return;
  if (process.env.NETLIFY !== 'true' || process.env.CONTEXT !== 'production') throw new Error('AI release checks require the production build environment');
  const key = process.env.OPENROUTER_API_KEY?.trim();
  stage = 'key validation';
  if (!key) throw new Error('OpenRouter production key is missing');
  const keyResponse = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  if (!keyResponse.ok) throw new Error(`OpenRouter key validation failed (HTTP ${keyResponse.status})`);
  const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
  const ids = [];
  try {
    stage = 'legacy pack review';
    const packTable = await db.$queryRawUnsafe('SELECT to_regclass(\'"AiCreditPack"\')::text AS name');
    if (packTable[0].name) {
      const packs = await db.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "AiCreditPack" WHERE "exhaustedAt" IS NULL AND "budgetGbp" > "usedCostGbp"');
      if (Number(packs[0].count) > 0) throw new Error('Unspent legacy AI packs require resolution before replacing daily pack usage');
    }
    console.log('AI release check passed: legacy pack review.');
    stage = 'allowance configuration';
    const ts = require('typescript'), cache = new Map();
    function load(file) {
      if (cache.has(file)) return cache.get(file).exports;
      const module = { exports: {} };
      cache.set(file, module);
      const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
      const localRequire = name => name === './db' ? { db } : name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
      new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
      return module.exports;
    }
    const lib = path.resolve(__dirname, '../lib');
    const budget = load(path.join(lib, 'ai-budget.ts'));
    const web = load(path.join(lib, 'ai-router.ts'));
    const bot = load(path.resolve(__dirname, '../../bot/src/lib/ai-router.ts'));
    assert.equal(budget.weeklyLimitMicros('PRO'), 2_000_000);
    assert.equal(budget.weeklyLimitMicros('ELITE'), 4_000_000);
    assert.equal(budget.weeklyLimitMicros('APEX'), 10_000_000);
    async function member(tier) {
      const id = `fortify-release-${randomUUID()}`;
      await db.user.create({ data: { id, tier, name: 'Temporary deployment check' } });
      ids.push(id);
      return id;
    }
    stage = 'shared PostgreSQL locking';
    const lockId = await member('PRO');
    const botBudget = load(path.resolve(__dirname, '../../bot/src/lib/ai-budget.ts'));
    const reservations = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? budget : botBudget).reserveAiCall(lockId, web.AI_MODELS.fast, 1_000_000, 1, true)));
    assert.equal(reservations.filter(Boolean).length, 2);
    assert.equal((await budget.weeklyAiUsage(lockId)).remainingGbp, 0);
    const pro = await member('PRO'), apex = await member('APEX');
    const base = { model: web.AI_MODELS.fast, max_tokens: 128, messages: [{ role: 'user', content: 'Reply with one short greeting.' }] };
    async function check(label, owner, api, params, fallback) {
      stage = label;
      const result = await api.routedAiMessage(owner, params);
      assert.equal(result.fortify.fallback, fallback);
      assert.ok(result.content.length);
      console.log(`AI release check passed: ${label}; model=${result.model}`);
      return result;
    }
    await check('website Claude', pro, web, base, false);
    await check('Discord premium Claude', apex, bot, { ...base, model: bot.AI_MODELS.premium }, false);
    await check('exhausted shared allowance uses alternative', lockId, bot, { ...base, max_tokens: 1024 }, true);
    const tools = [{ name: 'deployment_check', description: 'Return a deployment check result.', input_schema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] } }];
    // Match Fortify chat's automatic tool selection. The current Claude endpoint
    // rejects a forced named tool even though its catalogue advertises tool_choice.
    const toolPrompt = { ...base, tools, messages: [{ role: 'user', content: 'Call deployment_check with value OK.' }] };
    const toolResult = await check('tool call', pro, web, toolPrompt, false);
    const tool = toolResult.content.find(b => b.type === 'tool_use');
    assert.equal(tool?.name, 'deployment_check');
    await check('tool continuation', pro, web, { ...base, tools, messages: [...toolPrompt.messages, { role: 'assistant', content: toolResult.content }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: tool.id, content: 'OK' }] }] }, false);
    const pixel = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGNQSDhAU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAFLBAEwMJH4XAAAAAElFTkSuQmCC';
    await check('image understanding', pro, web, { ...base, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: pixel } }, { type: 'text', text: 'Describe this simple image briefly.' }] }] }, false);
    const rows = await db.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "AiUsageLedger" WHERE "userId" IN ($1, $2) AND "state" = \'settled\'', pro, apex);
    assert.ok(Number(rows[0].count) >= 5);
    console.log('AI release checks passed: live key, Claude, premium, alternative, tools, image, shared PostgreSQL locking and metering.');
  } finally {
    // Only users created by this invocation are removed; their test ledger cascades.
    if (ids.length) await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
}
main().catch(error => {
  // Provider/database errors may contain sensitive request details. Never print them.
  console.error(`AI release verification failed during ${stage}: ${error?.code || error?.status || error?.name || 'unknown error'}; SQL state=${error?.meta?.code || 'none'}. Production publication stopped.`);
  process.exitCode = 1;
});
