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

-- Growth Mission is deliberately additive and does not change legacy leads.
CREATE TABLE IF NOT EXISTS "GrowthMission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "offer" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GrowthMission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GrowthMission_userId_status_createdAt_idx" ON "GrowthMission"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "GrowthMission_businessId_status_idx" ON "GrowthMission"("businessId", "status");
CREATE TABLE IF NOT EXISTS "GrowthMissionLead" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "bookedAt" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthMissionLead_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "GrowthMissionLead" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);
ALTER TABLE "GrowthMissionLead" ADD COLUMN IF NOT EXISTS "bookedAt" TIMESTAMP(3);
ALTER TABLE "GrowthMissionLead" ADD COLUMN IF NOT EXISTS "wonAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "GrowthMissionLead_missionId_leadId_key" ON "GrowthMissionLead"("missionId", "leadId");
CREATE INDEX IF NOT EXISTS "GrowthMissionLead_missionId_decision_idx" ON "GrowthMissionLead"("missionId", "decision");
CREATE INDEX IF NOT EXISTS "GrowthMissionLead_leadId_idx" ON "GrowthMissionLead"("leadId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthMission_userId_fkey') THEN
    ALTER TABLE "GrowthMission" ADD CONSTRAINT "GrowthMission_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthMission_businessId_fkey') THEN
    ALTER TABLE "GrowthMission" ADD CONSTRAINT "GrowthMission_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthMissionLead_missionId_fkey') THEN
    ALTER TABLE "GrowthMissionLead" ADD CONSTRAINT "GrowthMissionLead_missionId_fkey"
      FOREIGN KEY ("missionId") REFERENCES "GrowthMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthMissionLead_leadId_fkey') THEN
    ALTER TABLE "GrowthMissionLead" ADD CONSTRAINT "GrowthMissionLead_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "LeadStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SitePulse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SitePulse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SitePulse_userId_checkedAt_idx" ON "SitePulse"("userId", "checkedAt");
CREATE INDEX IF NOT EXISTS "SitePulse_businessId_checkedAt_idx" ON "SitePulse"("businessId", "checkedAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SitePulse_userId_fkey') THEN
    ALTER TABLE "SitePulse" ADD CONSTRAINT "SitePulse_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SitePulse_businessId_fkey') THEN
    ALTER TABLE "SitePulse" ADD CONSTRAINT "SitePulse_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
