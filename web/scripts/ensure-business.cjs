const { PrismaClient } = require("@prisma/client");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

async function main() {
  if (process.env.NETLIFY !== "true" || process.env.CONTEXT !== "production") return;
  const client = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
  try {
    const statements = readFileSync(join(__dirname, "../prisma/business-setup.sql"), "utf8")
      .split(";")
      .map(statement => statement.trim())
      .filter(Boolean);
    await client.$transaction(async tx => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    }, { timeout: 30000 });
    await client.businessProfile.findFirst({ select: { id: true, active: true } });
    console.log("Business setup storage verified.");
  } finally {
    await client.$disconnect();
  }
}

main().catch(() => {
  console.error("Business setup storage could not be prepared; deployment stopped.");
  process.exitCode = 1;
});
