const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
async function main() {
  if (process.env.NETLIFY !== 'true' || process.env.CONTEXT !== 'production') return;
  const client = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
  try {
    const statements = readFileSync(join(__dirname, '../prisma/ai-routing.sql'), 'utf8').split(';').map(s => s.trim()).filter(Boolean);
    await client.$transaction(async tx => { for (const sql of statements) await tx.$executeRawUnsafe(sql); }, { timeout: 30000 });
    await client.$queryRawUnsafe('SELECT "id", "reservedMicros", "chargedMicros", "state" FROM "AiUsageLedger" LIMIT 1');
    console.log('Shared AI usage storage verified.');
  } finally { await client.$disconnect(); }
}
main().catch(() => { console.error('AI usage storage could not be prepared; deployment stopped.'); process.exitCode = 1; });
