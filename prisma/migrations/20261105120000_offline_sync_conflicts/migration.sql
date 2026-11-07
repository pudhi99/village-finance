-- CreateEnum
CREATE TYPE "SyncConflictStatus" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "SyncConflict" (
    "id" TEXT NOT NULL,
    "clientSyncId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "collectorId" TEXT NOT NULL,
    "deviceId" TEXT,
    "conflictReason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncConflictStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncConflict_clientSyncId_key" ON "SyncConflict"("clientSyncId");

-- CreateIndex
CREATE INDEX "SyncConflict_collectorId_idx" ON "SyncConflict"("collectorId");

-- CreateIndex
CREATE INDEX "SyncConflict_status_idx" ON "SyncConflict"("status");

-- CreateIndex
CREATE INDEX "SyncConflict_entityType_idx" ON "SyncConflict"("entityType");

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
