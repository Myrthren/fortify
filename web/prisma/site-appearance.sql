-- Additive deployment step for the universal site-theme setting.
CREATE TABLE IF NOT EXISTS "SiteAppearance" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "theme" TEXT NOT NULL DEFAULT 'scifi',
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteAppearance_pkey" PRIMARY KEY ("id")
);
