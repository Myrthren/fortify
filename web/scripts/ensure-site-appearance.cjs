// Run the additive appearance migration inside Netlify, where production
// database secrets are available. Local builds do not modify any database.
const { PrismaClient } = require("@prisma/client");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

async function main() {
  if (process.env.NETLIFY !== "true" || process.env.CONTEXT !== "production") return;
  const client = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
  });
  try {
    await client.$executeRawUnsafe(readFileSync(join(__dirname, "../prisma/site-appearance.sql"), "utf8"));
    await client.siteAppearance.findUnique({ where: { id: "global" }, select: { theme: true } });
    console.log("Site appearance storage verified.");
  } finally {
    await client.$disconnect();
  }
}

main().catch(() => {
  console.error("Site appearance storage could not be prepared; deployment stopped.");
  process.exitCode = 1;
});
