-- Guided multi-business setup. Safe to run more than once during deployment.
CREATE TABLE IF NOT EXISTS "BusinessProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "website" TEXT,
  "industry" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "businessModel" TEXT NOT NULL,
  "offer" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "bottleneck" TEXT NOT NULL,
  "teamSize" TEXT NOT NULL,
  "channels" JSONB NOT NULL DEFAULT '[]',
  "recommendations" JSONB NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT false,
  "setupComplete" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BusinessProfile_userId_active_idx" ON "BusinessProfile"("userId", "active");
CREATE INDEX IF NOT EXISTS "BusinessProfile_userId_updatedAt_idx" ON "BusinessProfile"("userId", "updatedAt");

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "updatedAt" DESC, "createdAt" DESC) AS position
  FROM "BusinessProfile"
  WHERE "active" = true
)
UPDATE "BusinessProfile" SET "active" = false
WHERE "id" IN (SELECT "id" FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessProfile_one_active_per_user_idx"
ON "BusinessProfile"("userId") WHERE "active" = true;
