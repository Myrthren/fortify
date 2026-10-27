const { PrismaClient } = require("@prisma/client");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

async function main() {
  if (process.env.NETLIFY !== "true" || process.env.CONTEXT !== "production") return;
  const client = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
  try {
    const statements = ["business-setup.sql", "simulation-tutorial.sql", "workspace-tutorial.sql"].map(file => readFileSync(join(__dirname, "../prisma", file), "utf8")).join("\n")
      .split(";")
      .map(statement => statement.trim())
      .filter(Boolean);
    await client.$transaction(async tx => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    }, { timeout: 30000 });
    await client.businessProfile.findFirst({ select: { id: true, active: true } });
    await client.simulationTutorialProgress.findFirst({ select: { id: true } });
    await client.workspaceTutorialProgress.findFirst({ select: { userId: true } });
    console.log("Business setup storage verified.");
  } finally {
    await client.$disconnect();
  }
}

main().catch(() => {
  console.error("Business setup storage could not be prepared; deployment stopped.");
  process.exitCode = 1;
});
