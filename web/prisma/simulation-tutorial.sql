CREATE TABLE IF NOT EXISTS "SimulationTutorialProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "outcome" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationTutorialProgress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SimulationTutorialProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SimulationTutorialProgress_userId_scope_key" ON "SimulationTutorialProgress"("userId", "scope");
