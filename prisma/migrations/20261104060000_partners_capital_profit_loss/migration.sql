-- ============================================================
-- MODULE 7: PARTNERS, CAPITAL, PROFIT & LOSS DISTRIBUTIONS
-- ============================================================

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXITED');

-- CreateEnum
CREATE TYPE "CapitalEntryType" AS ENUM ('INITIAL_CONTRIBUTION', 'ADDITIONAL_CONTRIBUTION', 'CAPITAL_WITHDRAWAL', 'CAPITAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WithdrawalType" AS ENUM ('CAPITAL_WITHDRAWAL', 'PROFIT_DRAWING');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CALCULATED', 'APPROVED', 'DISTRIBUTED', 'ALLOCATED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DistributionPaymentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT,
    "partnerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCapitalEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "entryType" "CapitalEntryType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "cashLedgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerCapitalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerRatio" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "capitalRatio" DECIMAL(7,4) NOT NULL,
    "profitRatio" DECIMAL(7,4) NOT NULL,
    "lossRatio" DECIMAL(7,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerRatio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerWithdrawal" (
    "id" TEXT NOT NULL,
    "withdrawalNumber" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "withdrawalType" "WithdrawalType" NOT NULL DEFAULT 'CAPITAL_WITHDRAWAL',
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentMode" "PaymentMode",
    "reference" TEXT,
    "notes" TEXT,
    "capitalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitPeriod" (
    "id" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "totalFinanceChargeCollectedPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPrincipalRecoveredPaise" INTEGER NOT NULL DEFAULT 0,
    "totalApprovedExpensesPaise" INTEGER NOT NULL DEFAULT 0,
    "netProfitPaise" INTEGER NOT NULL DEFAULT 0,
    "retainedEarningsPaise" INTEGER NOT NULL DEFAULT 0,
    "distributableProfitPaise" INTEGER NOT NULL DEFAULT 0,
    "calculationPolicy" TEXT DEFAULT 'CASH_BASIS_COLLECTED_CHARGES',
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitDistribution" (
    "id" TEXT NOT NULL,
    "distributionNumber" TEXT NOT NULL,
    "profitPeriodId" TEXT NOT NULL,
    "totalDistributedPaise" INTEGER NOT NULL,
    "distributionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DistributionStatus" NOT NULL DEFAULT 'DRAFT',
    "postedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitDistributionDetail" (
    "id" TEXT NOT NULL,
    "profitDistributionId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "profitRatioSnapshot" DECIMAL(7,4) NOT NULL,
    "calculatedSharePaise" INTEGER NOT NULL,
    "allocatedSharePaise" INTEGER NOT NULL,
    "paymentStatus" "DistributionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentMode" "PaymentMode",
    "reference" TEXT,
    "notes" TEXT,

    CONSTRAINT "ProfitDistributionDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LossPeriod" (
    "id" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "totalLossPaise" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LossPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LossAllocation" (
    "id" TEXT NOT NULL,
    "allocationNumber" TEXT NOT NULL,
    "lossPeriodId" TEXT NOT NULL,
    "totalAllocatedPaise" INTEGER NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DistributionStatus" NOT NULL DEFAULT 'DRAFT',
    "postedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LossAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LossAllocationDetail" (
    "id" TEXT NOT NULL,
    "lossAllocationId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "lossRatioSnapshot" DECIMAL(7,4) NOT NULL,
    "allocatedLossPaise" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "LossAllocationDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "Partner_userProfileId_key" ON "Partner"("userProfileId");
CREATE UNIQUE INDEX "Partner_partnerCode_key" ON "Partner"("partnerCode");
CREATE INDEX "Partner_status_idx" ON "Partner"("status");
CREATE INDEX "Partner_partnerCode_idx" ON "Partner"("partnerCode");

CREATE UNIQUE INDEX "PartnerCapitalEntry_entryNumber_key" ON "PartnerCapitalEntry"("entryNumber");
CREATE INDEX "PartnerCapitalEntry_partnerId_idx" ON "PartnerCapitalEntry"("partnerId");
CREATE INDEX "PartnerCapitalEntry_entryType_idx" ON "PartnerCapitalEntry"("entryType");
CREATE INDEX "PartnerCapitalEntry_effectiveDate_idx" ON "PartnerCapitalEntry"("effectiveDate");

CREATE INDEX "PartnerRatio_partnerId_idx" ON "PartnerRatio"("partnerId");
CREATE INDEX "PartnerRatio_effectiveFrom_idx" ON "PartnerRatio"("effectiveFrom");
CREATE INDEX "PartnerRatio_effectiveTo_idx" ON "PartnerRatio"("effectiveTo");

CREATE UNIQUE INDEX "PartnerWithdrawal_withdrawalNumber_key" ON "PartnerWithdrawal"("withdrawalNumber");
CREATE UNIQUE INDEX "PartnerWithdrawal_capitalEntryId_key" ON "PartnerWithdrawal"("capitalEntryId");
CREATE INDEX "PartnerWithdrawal_partnerId_idx" ON "PartnerWithdrawal"("partnerId");
CREATE INDEX "PartnerWithdrawal_status_idx" ON "PartnerWithdrawal"("status");
CREATE INDEX "PartnerWithdrawal_withdrawalType_idx" ON "PartnerWithdrawal"("withdrawalType");

CREATE UNIQUE INDEX "ProfitPeriod_periodCode_key" ON "ProfitPeriod"("periodCode");
CREATE INDEX "ProfitPeriod_status_idx" ON "ProfitPeriod"("status");
CREATE INDEX "ProfitPeriod_startDate_idx" ON "ProfitPeriod"("startDate");
CREATE INDEX "ProfitPeriod_endDate_idx" ON "ProfitPeriod"("endDate");

CREATE UNIQUE INDEX "ProfitDistribution_distributionNumber_key" ON "ProfitDistribution"("distributionNumber");
CREATE UNIQUE INDEX "ProfitDistribution_profitPeriodId_key" ON "ProfitDistribution"("profitPeriodId");
CREATE INDEX "ProfitDistribution_status_idx" ON "ProfitDistribution"("status");
CREATE INDEX "ProfitDistribution_distributionDate_idx" ON "ProfitDistribution"("distributionDate");

CREATE INDEX "ProfitDistributionDetail_profitDistributionId_idx" ON "ProfitDistributionDetail"("profitDistributionId");
CREATE INDEX "ProfitDistributionDetail_partnerId_idx" ON "ProfitDistributionDetail"("partnerId");
CREATE INDEX "ProfitDistributionDetail_paymentStatus_idx" ON "ProfitDistributionDetail"("paymentStatus");

CREATE UNIQUE INDEX "LossPeriod_periodCode_key" ON "LossPeriod"("periodCode");
CREATE INDEX "LossPeriod_status_idx" ON "LossPeriod"("status");
CREATE INDEX "LossPeriod_startDate_idx" ON "LossPeriod"("startDate");
CREATE INDEX "LossPeriod_endDate_idx" ON "LossPeriod"("endDate");

CREATE UNIQUE INDEX "LossAllocation_allocationNumber_key" ON "LossAllocation"("allocationNumber");
CREATE UNIQUE INDEX "LossAllocation_lossPeriodId_key" ON "LossAllocation"("lossPeriodId");
CREATE INDEX "LossAllocation_status_idx" ON "LossAllocation"("status");
CREATE INDEX "LossAllocation_allocationDate_idx" ON "LossAllocation"("allocationDate");

CREATE INDEX "LossAllocationDetail_lossAllocationId_idx" ON "LossAllocationDetail"("lossAllocationId");
CREATE INDEX "LossAllocationDetail_partnerId_idx" ON "LossAllocationDetail"("partnerId");

-- AddForeignKeys
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerCapitalEntry" ADD CONSTRAINT "PartnerCapitalEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerCapitalEntry" ADD CONSTRAINT "PartnerCapitalEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerCapitalEntry" ADD CONSTRAINT "PartnerCapitalEntry_cashLedgerEntryId_fkey" FOREIGN KEY ("cashLedgerEntryId") REFERENCES "CashLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerRatio" ADD CONSTRAINT "PartnerRatio_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerRatio" ADD CONSTRAINT "PartnerRatio_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerWithdrawal" ADD CONSTRAINT "PartnerWithdrawal_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerWithdrawal" ADD CONSTRAINT "PartnerWithdrawal_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerWithdrawal" ADD CONSTRAINT "PartnerWithdrawal_capitalEntryId_fkey" FOREIGN KEY ("capitalEntryId") REFERENCES "PartnerCapitalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfitPeriod" ADD CONSTRAINT "ProfitPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfitPeriod" ADD CONSTRAINT "ProfitPeriod_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfitDistribution" ADD CONSTRAINT "ProfitDistribution_profitPeriodId_fkey" FOREIGN KEY ("profitPeriodId") REFERENCES "ProfitPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitDistribution" ADD CONSTRAINT "ProfitDistribution_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfitDistributionDetail" ADD CONSTRAINT "ProfitDistributionDetail_profitDistributionId_fkey" FOREIGN KEY ("profitDistributionId") REFERENCES "ProfitDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfitDistributionDetail" ADD CONSTRAINT "ProfitDistributionDetail_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LossPeriod" ADD CONSTRAINT "LossPeriod_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LossAllocation" ADD CONSTRAINT "LossAllocation_lossPeriodId_fkey" FOREIGN KEY ("lossPeriodId") REFERENCES "LossPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LossAllocation" ADD CONSTRAINT "LossAllocation_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LossAllocationDetail" ADD CONSTRAINT "LossAllocationDetail_lossAllocationId_fkey" FOREIGN KEY ("lossAllocationId") REFERENCES "LossAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LossAllocationDetail" ADD CONSTRAINT "LossAllocationDetail_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
