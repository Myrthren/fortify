-- Idempotent additions required by the current application schema.
-- Keep this deliberately additive: production contains legacy tables that
-- are not represented in schema.prisma and must not be removed by db push.
ALTER TABLE "PaypalConnection"
  ADD COLUMN IF NOT EXISTS "clientSecret" TEXT;
