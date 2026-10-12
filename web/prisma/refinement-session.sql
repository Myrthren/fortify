-- AlterTable
ALTER TABLE "CompetitorWatch" ADD COLUMN     "clientWorkspaceId" TEXT,
ADD COLUMN     "nextScanAt" TIMESTAMP(3),
ADD COLUMN     "scanLeaseUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CompetitorWatchScan" ADD COLUMN     "evidence" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'unchanged';

-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "clientWorkspaceId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "ContactCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientWorkspace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entries" JSONB NOT NULL DEFAULT '[]',
    "brandVoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactCheck_expiresAt_idx" ON "ContactCheck"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContactCheck_userId_email_key" ON "ContactCheck"("userId", "email");

-- CreateIndex
CREATE INDEX "ClientWorkspace_userId_idx" ON "ClientWorkspace"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_idempotencyKey_key" ON "WorkflowRun"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "ContactCheck" ADD CONSTRAINT "ContactCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientWorkspace" ADD CONSTRAINT "ClientWorkspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientWorkspace" ADD CONSTRAINT "ClientWorkspace_brandVoiceId_fkey" FOREIGN KEY ("brandVoiceId") REFERENCES "BrandVoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorWatch" ADD CONSTRAINT "CompetitorWatch_clientWorkspaceId_fkey" FOREIGN KEY ("clientWorkspaceId") REFERENCES "ClientWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_clientWorkspaceId_fkey" FOREIGN KEY ("clientWorkspaceId") REFERENCES "ClientWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
