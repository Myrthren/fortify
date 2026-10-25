-- Shared, additive ledger. Pending and uncertain calls retain their reservation.
CREATE TABLE IF NOT EXISTS "AiUsageLedger" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "weekStart" TIMESTAMPTZ NOT NULL,
  "model" TEXT NOT NULL,
  "isClaude" BOOLEAN NOT NULL,
  "reservedMicros" INTEGER NOT NULL CHECK ("reservedMicros" >= 0),
  "chargedMicros" INTEGER CHECK ("chargedMicros" >= 0),
  "fx" DOUBLE PRECISION NOT NULL,
  "costUsd" DOUBLE PRECISION,
  "providerRunId" TEXT UNIQUE,
  "estimated" BOOLEAN NOT NULL DEFAULT false,
  "state" TEXT NOT NULL DEFAULT 'reserved',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "AiUsageLedger_userId_weekStart_idx" ON "AiUsageLedger"("userId", "weekStart");
