const { PrismaClient } = require("@prisma/client");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
async function main() {
  if (process.env.NETLIFY !== "true" || process.env.CONTEXT !== "production") return;
  const client = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
  try {
    const statements = readFileSync(join(__dirname, "../prisma/workspace-upgrades.sql"), "utf8").split(";").map(sql => sql.trim()).filter(Boolean);
    await client.$transaction(async tx => { for (const statement of statements) await tx.$executeRawUnsafe(statement); }, { timeout: 30000 });
    await client.workspacePreference.findFirst({ select: { userId: true } });
    await client.leadStatus.findFirst({ select: { id: true, draft: true, followUpAt: true } });
    console.log("Workspace and pipeline storage verified.");
  } finally { await client.$disconnect(); }
}
main().catch(() => { console.error("Workspace storage could not be prepared; deployment stopped."); process.exitCode = 1; });
