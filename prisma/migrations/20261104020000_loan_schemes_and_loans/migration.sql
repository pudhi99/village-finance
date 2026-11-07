-- CreateEnum
CREATE TYPE "SchemeFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIALLY_DISBURSED', 'DISBURSED', 'ACTIVE', 'PAID', 'CANCELLED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisbursementMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "CancellationStatus" AS ENUM ('PENDING_RECOVERY', 'SETTLED');

-- CreateTable
CREATE TABLE "LoanScheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "frequency" "SchemeFrequency" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanSchemeVersion" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "principalPaise" INTEGER NOT NULL,
    "totalFinanceChargePaise" INTEGER NOT NULL,
    "totalRepaymentPaise" INTEGER NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanSchemeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanSchemeInstallmentRule" (
    "id" TEXT NOT NULL,
    "schemeVersionId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueOffsetDays" INTEGER NOT NULL,
    "principalDuePaise" INTEGER NOT NULL,
    "financeChargeDuePaise" INTEGER NOT NULL,
    "totalDuePaise" INTEGER NOT NULL,

    CONSTRAINT "LoanSchemeInstallmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "schemeVersionId" TEXT NOT NULL,
    "requestedPrincipalPaise" INTEGER NOT NULL,
    "sanctionedPrincipalPaise" INTEGER NOT NULL,
    "totalFinanceChargePaise" INTEGER NOT NULL,
    "totalRepaymentPaise" INTEGER NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'DRAFT',
    "applicantId" TEXT NOT NULL,
    "notes" TEXT,
    "isOverlapping" BOOLEAN NOT NULL DEFAULT false,
    "overlappingApprovalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApproval" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "reason" TEXT,
    "termsSnapshot" JSONB NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanDisbursement" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "disbursementNumber" INTEGER NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "disbursedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" "DisbursementMode" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "disbursedBy" TEXT NOT NULL,
    "lineId" TEXT,
    "cashBagId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanScheduleVersion" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedReason" TEXT NOT NULL,
    "totalPrincipalPaise" INTEGER NOT NULL,
    "totalFinanceChargePaise" INTEGER NOT NULL,
    "totalRepaymentPaise" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LoanScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalDuePaise" INTEGER NOT NULL,
    "financeChargeDuePaise" INTEGER NOT NULL,
    "totalDuePaise" INTEGER NOT NULL,
    "principalPaidPaise" INTEGER NOT NULL DEFAULT 0,
    "financeChargePaidPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaidPaise" INTEGER NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanCancellation" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "cancelledBy" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "disbursedPrincipalPaise" INTEGER NOT NULL,
    "repaidPrincipalPaise" INTEGER NOT NULL,
    "netRecoverablePrincipalPaise" INTEGER NOT NULL,
    "status" "CancellationStatus" NOT NULL DEFAULT 'PENDING_RECOVERY',

    CONSTRAINT "LoanCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryAllocation" (
    "id" TEXT NOT NULL,
    "loanCancellationId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paymentReference" TEXT,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanScheme_code_key" ON "LoanScheme"("code");

-- CreateIndex
CREATE INDEX "LoanScheme_code_idx" ON "LoanScheme"("code");

-- CreateIndex
CREATE INDEX "LoanSchemeVersion_schemeId_idx" ON "LoanSchemeVersion"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanSchemeVersion_schemeId_versionNumber_key" ON "LoanSchemeVersion"("schemeId", "versionNumber");

-- CreateIndex
CREATE INDEX "LoanSchemeInstallmentRule_schemeVersionId_idx" ON "LoanSchemeInstallmentRule"("schemeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanSchemeInstallmentRule_schemeVersionId_installmentNumber_key" ON "LoanSchemeInstallmentRule"("schemeVersionId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanNumber_key" ON "Loan"("loanNumber");

-- CreateIndex
CREATE INDEX "Loan_customerId_idx" ON "Loan"("customerId");

-- CreateIndex
CREATE INDEX "Loan_schemeId_idx" ON "Loan"("schemeId");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "Loan_applicantId_idx" ON "Loan"("applicantId");

-- CreateIndex
CREATE INDEX "LoanApproval_loanId_idx" ON "LoanApproval"("loanId");

-- CreateIndex
CREATE INDEX "LoanApproval_approverId_idx" ON "LoanApproval"("approverId");

-- CreateIndex
CREATE INDEX "LoanDisbursement_loanId_idx" ON "LoanDisbursement"("loanId");

-- CreateIndex
CREATE INDEX "LoanDisbursement_disbursedBy_idx" ON "LoanDisbursement"("disbursedBy");

-- CreateIndex
CREATE UNIQUE INDEX "LoanDisbursement_loanId_disbursementNumber_key" ON "LoanDisbursement"("loanId", "disbursementNumber");

-- CreateIndex
CREATE INDEX "LoanScheduleVersion_loanId_idx" ON "LoanScheduleVersion"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanScheduleVersion_loanId_versionNumber_key" ON "LoanScheduleVersion"("loanId", "versionNumber");

-- CreateIndex
CREATE INDEX "LoanInstallment_loanId_idx" ON "LoanInstallment"("loanId");

-- CreateIndex
CREATE INDEX "LoanInstallment_dueDate_idx" ON "LoanInstallment"("dueDate");

-- CreateIndex
CREATE INDEX "LoanInstallment_status_idx" ON "LoanInstallment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LoanInstallment_scheduleVersionId_installmentNumber_key" ON "LoanInstallment"("scheduleVersionId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LoanCancellation_loanId_key" ON "LoanCancellation"("loanId");

-- CreateIndex
CREATE INDEX "LoanCancellation_loanId_idx" ON "LoanCancellation"("loanId");

-- CreateIndex
CREATE INDEX "LoanCancellation_status_idx" ON "LoanCancellation"("status");

-- CreateIndex
CREATE INDEX "RecoveryAllocation_loanCancellationId_idx" ON "RecoveryAllocation"("loanCancellationId");

-- AddForeignKey
ALTER TABLE "LoanSchemeVersion" ADD CONSTRAINT "LoanSchemeVersion_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "LoanScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanSchemeInstallmentRule" ADD CONSTRAINT "LoanSchemeInstallmentRule_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "LoanSchemeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "LoanScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "LoanSchemeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApproval" ADD CONSTRAINT "LoanApproval_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApproval" ADD CONSTRAINT "LoanApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanDisbursement" ADD CONSTRAINT "LoanDisbursement_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanDisbursement" ADD CONSTRAINT "LoanDisbursement_disbursedBy_fkey" FOREIGN KEY ("disbursedBy") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanDisbursement" ADD CONSTRAINT "LoanDisbursement_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanScheduleVersion" ADD CONSTRAINT "LoanScheduleVersion_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "LoanScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanCancellation" ADD CONSTRAINT "LoanCancellation_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanCancellation" ADD CONSTRAINT "LoanCancellation_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAllocation" ADD CONSTRAINT "RecoveryAllocation_loanCancellationId_fkey" FOREIGN KEY ("loanCancellationId") REFERENCES "LoanCancellation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryAllocation" ADD CONSTRAINT "RecoveryAllocation_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
