CREATE TABLE IF NOT EXISTS "FuturePlan" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "document" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "cardCount" INTEGER NOT NULL DEFAULT 0,
  "doneCount" INTEGER NOT NULL DEFAULT 0,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FuturePlan_userId_archived_updatedAt_idx" ON "FuturePlan"("userId", "archived", "updatedAt");
CREATE TABLE IF NOT EXISTS "PlanProcedureRun" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL REFERENCES "FuturePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nodeId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "runId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'starting',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanProcedureRun_planId_nodeId_key" ON "PlanProcedureRun"("planId", "nodeId");
