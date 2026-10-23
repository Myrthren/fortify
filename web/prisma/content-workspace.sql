CREATE TABLE IF NOT EXISTS "ContentRecord" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "document" JSONB NOT NULL,
  "history" JSONB NOT NULL DEFAULT '[]',
  "version" INTEGER NOT NULL DEFAULT 1,
  "planId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ContentRecord_userId_kind_updatedAt_idx" ON "ContentRecord"("userId", "kind", "updatedAt");
ALTER TABLE "ContentRecord" ADD COLUMN IF NOT EXISTS "history" JSONB NOT NULL DEFAULT '[]';
