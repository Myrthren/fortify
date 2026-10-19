-- Idempotent additions required by the current application schema.
-- Keep this deliberately additive: production contains legacy tables that
-- are not represented in schema.prisma and must not be removed by db push.
ALTER TABLE "PaypalConnection"
  ADD COLUMN IF NOT EXISTS "clientSecret" TEXT;

-- Weekly lead pack settings (LeadPackSetting in schema.prisma).
CREATE TABLE IF NOT EXISTS "LeadPackSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "offer" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pendingRunId" TEXT,
    "pendingSince" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadPackSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadPackSetting_userId_key" ON "LeadPackSetting"("userId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadPackSetting_userId_fkey') THEN
    ALTER TABLE "LeadPackSetting" ADD CONSTRAINT "LeadPackSetting_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
