-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('NOT_VISITED', 'VISITED', 'COLLECTED', 'PARTIAL', 'NOT_AVAILABLE');

-- CreateTable
CREATE TABLE "CollectionSession" (
    "id" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'PLANNED',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "openedById" TEXT,
    "closedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTeamMember" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'COLLECTOR',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionVisit" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'NOT_VISITED',
    "visitedAt" TIMESTAMP(3),
    "notes" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitGPSLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "visitId" TEXT,
    "customerId" TEXT,
    "collectorId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT,

    CONSTRAINT "VisitGPSLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionSession_sessionNumber_key" ON "CollectionSession"("sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionSession_lineId_sessionDate_key" ON "CollectionSession"("lineId", "sessionDate");

-- CreateIndex
CREATE INDEX "CollectionSession_lineId_idx" ON "CollectionSession"("lineId");

-- CreateIndex
CREATE INDEX "CollectionSession_sessionDate_idx" ON "CollectionSession"("sessionDate");

-- CreateIndex
CREATE INDEX "CollectionSession_status_idx" ON "CollectionSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTeamMember_sessionId_userId_key" ON "SessionTeamMember"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "SessionTeamMember_sessionId_idx" ON "SessionTeamMember"("sessionId");

-- CreateIndex
CREATE INDEX "SessionTeamMember_userId_idx" ON "SessionTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionVisit_sessionId_customerId_key" ON "CollectionVisit"("sessionId", "customerId");

-- CreateIndex
CREATE INDEX "CollectionVisit_sessionId_idx" ON "CollectionVisit"("sessionId");

-- CreateIndex
CREATE INDEX "CollectionVisit_customerId_idx" ON "CollectionVisit"("customerId");

-- CreateIndex
CREATE INDEX "CollectionVisit_collectorId_idx" ON "CollectionVisit"("collectorId");

-- CreateIndex
CREATE INDEX "CollectionVisit_status_idx" ON "CollectionVisit"("status");

-- CreateIndex
CREATE INDEX "VisitGPSLog_sessionId_idx" ON "VisitGPSLog"("sessionId");

-- CreateIndex
CREATE INDEX "VisitGPSLog_visitId_idx" ON "VisitGPSLog"("visitId");

-- CreateIndex
CREATE INDEX "VisitGPSLog_customerId_idx" ON "VisitGPSLog"("customerId");

-- CreateIndex
CREATE INDEX "VisitGPSLog_collectorId_idx" ON "VisitGPSLog"("collectorId");

-- CreateIndex
CREATE INDEX "VisitGPSLog_capturedAt_idx" ON "VisitGPSLog"("capturedAt");

-- AddForeignKey
ALTER TABLE "CollectionSession" ADD CONSTRAINT "CollectionSession_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSession" ADD CONSTRAINT "CollectionSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSession" ADD CONSTRAINT "CollectionSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTeamMember" ADD CONSTRAINT "SessionTeamMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollectionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTeamMember" ADD CONSTRAINT "SessionTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionVisit" ADD CONSTRAINT "CollectionVisit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollectionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionVisit" ADD CONSTRAINT "CollectionVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionVisit" ADD CONSTRAINT "CollectionVisit_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionVisit" ADD CONSTRAINT "CollectionVisit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitGPSLog" ADD CONSTRAINT "VisitGPSLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CollectionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitGPSLog" ADD CONSTRAINT "VisitGPSLog_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "CollectionVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitGPSLog" ADD CONSTRAINT "VisitGPSLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitGPSLog" ADD CONSTRAINT "VisitGPSLog_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
