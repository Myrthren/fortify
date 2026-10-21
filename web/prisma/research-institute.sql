CREATE TABLE IF NOT EXISTS "ResearchDecisionBatch" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "input" TEXT NOT NULL,
  "output" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ResearchDecisionBatch_userId_input_key" ON "ResearchDecisionBatch"("userId", "input");
CREATE INDEX IF NOT EXISTS "ResearchDecisionBatch_createdAt_idx" ON "ResearchDecisionBatch"("createdAt");
