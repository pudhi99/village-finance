-- Module 06 Migration: Cash Bag, Cash Ledger, Transfers, Expenses & Reconciliation

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE "LedgerEntryType" AS ENUM (
    'OPENING',
    'COLLECTION',
    'LOAN_DISBURSEMENT',
    'EXPENSE',
    'ADDITIONAL_CASH_IN',
    'WITHDRAWAL',
    'BANK_DEPOSIT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'HANDOVER_OUT',
    'HANDOVER_IN',
    'REVERSAL',
    'ADJUSTMENT'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerDirection" AS ENUM ('IN', 'OUT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReconciliationStatus" AS ENUM ('BALANCED', 'SHORTAGE', 'EXCESS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReconciliationApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "HandoverStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Create CashBag table
CREATE TABLE IF NOT EXISTS "CashBag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "lineId" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashBag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashBag_code_key" UNIQUE ("code"),
  CONSTRAINT "CashBag_lineId_key" UNIQUE ("lineId")
);

-- 3. Create CashBagOpening table
CREATE TABLE IF NOT EXISTS "CashBagOpening" (
  "id" TEXT NOT NULL,
  "cashBagId" TEXT NOT NULL,
  "openingDate" TIMESTAMP(3) NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "openedById" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashBagOpening_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashBagOpening_cashBagId_openingDate_key" UNIQUE ("cashBagId", "openingDate")
);

-- 4. Create ExpenseCategory table
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExpenseCategory_name_key" UNIQUE ("name"),
  CONSTRAINT "ExpenseCategory_code_key" UNIQUE ("code")
);

-- 5. Create Expense table
CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL,
  "expenseNumber" TEXT NOT NULL,
  "cashBagId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "recordedById" TEXT NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "description" TEXT NOT NULL,
  "receiptUrl" TEXT,
  "approvalStatus" "ExpenseApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "isSelfApproved" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_expenseNumber_key" UNIQUE ("expenseNumber")
);

-- 6. Create CashTransfer table
CREATE TABLE IF NOT EXISTS "CashTransfer" (
  "id" TEXT NOT NULL,
  "transferNumber" TEXT NOT NULL,
  "sourceCashBagId" TEXT NOT NULL,
  "destinationCashBagId" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "initiatedById" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashTransfer_transferNumber_key" UNIQUE ("transferNumber")
);

-- 7. Create CashHandover table
CREATE TABLE IF NOT EXISTS "CashHandover" (
  "id" TEXT NOT NULL,
  "handoverNumber" TEXT NOT NULL,
  "cashBagId" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "handedOverById" TEXT NOT NULL,
  "receivedById" TEXT,
  "status" "HandoverStatus" NOT NULL DEFAULT 'PENDING',
  "handedOverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashHandover_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashHandover_handoverNumber_key" UNIQUE ("handoverNumber")
);

-- 8. Create CashReconciliation table
CREATE TABLE IF NOT EXISTS "CashReconciliation" (
  "id" TEXT NOT NULL,
  "cashBagId" TEXT NOT NULL,
  "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reconciledById" TEXT NOT NULL,
  "expectedBalancePaise" INTEGER NOT NULL,
  "actualBalancePaise" INTEGER NOT NULL,
  "differencePaise" INTEGER NOT NULL,
  "status" "ReconciliationStatus" NOT NULL,
  "reason" TEXT,
  "approvalStatus" "ReconciliationApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashReconciliation_pkey" PRIMARY KEY ("id")
);

-- 9. Create CashLedgerEntry table (Append-only)
CREATE TABLE IF NOT EXISTS "CashLedgerEntry" (
  "id" TEXT NOT NULL,
  "cashBagId" TEXT NOT NULL,
  "entryType" "LedgerEntryType" NOT NULL,
  "direction" "LedgerDirection" NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "balanceAfterPaise" INTEGER NOT NULL,
  "actorId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentId" TEXT,
  "disbursementId" TEXT,
  "expenseId" TEXT,
  "transferId" TEXT,
  "handoverId" TEXT,
  "reconciliationId" TEXT,
  CONSTRAINT "CashLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashLedgerEntry_paymentId_key" UNIQUE ("paymentId"),
  CONSTRAINT "CashLedgerEntry_disbursementId_key" UNIQUE ("disbursementId"),
  CONSTRAINT "CashLedgerEntry_expenseId_key" UNIQUE ("expenseId")
);

-- 10. Foreign Keys
ALTER TABLE "CashBag" DROP CONSTRAINT IF EXISTS "CashBag_lineId_fkey";
ALTER TABLE "CashBag" ADD CONSTRAINT "CashBag_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashBagOpening" DROP CONSTRAINT IF EXISTS "CashBagOpening_cashBagId_fkey";
ALTER TABLE "CashBagOpening" ADD CONSTRAINT "CashBagOpening_cashBagId_fkey" FOREIGN KEY ("cashBagId") REFERENCES "CashBag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CashBagOpening" DROP CONSTRAINT IF EXISTS "CashBagOpening_openedById_fkey";
ALTER TABLE "CashBagOpening" ADD CONSTRAINT "CashBagOpening_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_cashBagId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cashBagId_fkey" FOREIGN KEY ("cashBagId") REFERENCES "CashBag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_categoryId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_recordedById_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_approvedById_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashTransfer" DROP CONSTRAINT IF EXISTS "CashTransfer_sourceCashBagId_fkey";
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_sourceCashBagId_fkey" FOREIGN KEY ("sourceCashBagId") REFERENCES "CashBag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashTransfer" DROP CONSTRAINT IF EXISTS "CashTransfer_destinationCashBagId_fkey";
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_destinationCashBagId_fkey" FOREIGN KEY ("destinationCashBagId") REFERENCES "CashBag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashTransfer" DROP CONSTRAINT IF EXISTS "CashTransfer_initiatedById_fkey";
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashHandover" DROP CONSTRAINT IF EXISTS "CashHandover_cashBagId_fkey";
ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_cashBagId_fkey" FOREIGN KEY ("cashBagId") REFERENCES "CashBag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CashHandover" DROP CONSTRAINT IF EXISTS "CashHandover_handedOverById_fkey";
ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_handedOverById_fkey" FOREIGN KEY ("handedOverById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashHandover" DROP CONSTRAINT IF EXISTS "CashHandover_receivedById_fkey";
ALTER TABLE "CashHandover" ADD CONSTRAINT "CashHandover_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashReconciliation" DROP CONSTRAINT IF EXISTS "CashReconciliation_cashBagId_fkey";
ALTER TABLE "CashReconciliation" ADD CONSTRAINT "CashReconciliation_cashBagId_fkey" FOREIGN KEY ("cashBagId") REFERENCES "CashBag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CashReconciliation" DROP CONSTRAINT IF EXISTS "CashReconciliation_reconciledById_fkey";
ALTER TABLE "CashReconciliation" ADD CONSTRAINT "CashReconciliation_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashReconciliation" DROP CONSTRAINT IF EXISTS "CashReconciliation_approvedById_fkey";
ALTER TABLE "CashReconciliation" ADD CONSTRAINT "CashReconciliation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashLedgerEntry" DROP CONSTRAINT IF EXISTS "CashLedgerEntry_cashBagId_fkey";
ALTER TABLE "CashLedgerEntry" ADD CONSTRAINT "CashLedgerEntry_cashBagId_fkey" FOREIGN KEY ("cashBagId") REFERENCES "CashBag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CashLedgerEntry" DROP CONSTRAINT IF EXISTS "CashLedgerEntry_actorId_fkey";
ALTER TABLE "CashLedgerEntry" ADD CONSTRAINT "CashLedgerEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashLedgerEntry" DROP CONSTRAINT IF EXISTS "CashLedgerEntry_paymentId_fkey";
ALTER TABLE "CashLedgerEntry" ADD CONSTRAINT "CashLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashLedgerEntry" DROP CONSTRAINT IF EXISTS "CashLedgerEntry_disbursementId_fkey";
ALTER TABLE "CashLedgerEntry" ADD CONSTRAINT "CashLedgerEntry_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "LoanDisbursement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashLedgerEntry" DROP CONSTRAINT IF EXISTS "CashLedgerEntry_expenseId_fkey";
ALTER TABLE "CashLedgerEntry" ADD CONSTRAINT "CashLedgerEntry_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashLedgerEntry" DROP CONSTRAINT IF EXISTS "CashLedgerEntry_transferId_fkey";
ALTER TABLE "CashLedgerEntry" ADD CONSTRAINT "CashLedgerEntry_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "CashTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashLedgerEntry" DROP CONSTRAINT IF EXISTS "CashLedgerEntry_handoverId_fkey";
ALTER TABLE "CashLedgerEntry" ADD CONSTRAINT "CashLedgerEntry_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "CashHandover"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashLedgerEntry" DROP CONSTRAINT IF EXISTS "CashLedgerEntry_reconciliationId_fkey";
ALTER TABLE "CashLedgerEntry" ADD CONSTRAINT "CashLedgerEntry_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "CashReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 11. Indexes for performance
CREATE INDEX IF NOT EXISTS "CashBag_lineId_idx" ON "CashBag"("lineId");
CREATE INDEX IF NOT EXISTS "CashBag_isActive_idx" ON "CashBag"("isActive");

CREATE INDEX IF NOT EXISTS "CashBagOpening_cashBagId_idx" ON "CashBagOpening"("cashBagId");
CREATE INDEX IF NOT EXISTS "CashBagOpening_openingDate_idx" ON "CashBagOpening"("openingDate");
CREATE INDEX IF NOT EXISTS "CashBagOpening_openedById_idx" ON "CashBagOpening"("openedById");

CREATE INDEX IF NOT EXISTS "ExpenseCategory_isActive_idx" ON "ExpenseCategory"("isActive");

CREATE INDEX IF NOT EXISTS "Expense_cashBagId_idx" ON "Expense"("cashBagId");
CREATE INDEX IF NOT EXISTS "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX IF NOT EXISTS "Expense_recordedById_idx" ON "Expense"("recordedById");
CREATE INDEX IF NOT EXISTS "Expense_approvalStatus_idx" ON "Expense"("approvalStatus");
CREATE INDEX IF NOT EXISTS "Expense_expenseDate_idx" ON "Expense"("expenseDate");

CREATE INDEX IF NOT EXISTS "CashTransfer_sourceCashBagId_idx" ON "CashTransfer"("sourceCashBagId");
CREATE INDEX IF NOT EXISTS "CashTransfer_destinationCashBagId_idx" ON "CashTransfer"("destinationCashBagId");
CREATE INDEX IF NOT EXISTS "CashTransfer_initiatedById_idx" ON "CashTransfer"("initiatedById");
CREATE INDEX IF NOT EXISTS "CashTransfer_createdAt_idx" ON "CashTransfer"("createdAt");

CREATE INDEX IF NOT EXISTS "CashHandover_cashBagId_idx" ON "CashHandover"("cashBagId");
CREATE INDEX IF NOT EXISTS "CashHandover_handedOverById_idx" ON "CashHandover"("handedOverById");
CREATE INDEX IF NOT EXISTS "CashHandover_receivedById_idx" ON "CashHandover"("receivedById");
CREATE INDEX IF NOT EXISTS "CashHandover_status_idx" ON "CashHandover"("status");
CREATE INDEX IF NOT EXISTS "CashHandover_handedOverAt_idx" ON "CashHandover"("handedOverAt");

CREATE INDEX IF NOT EXISTS "CashReconciliation_cashBagId_idx" ON "CashReconciliation"("cashBagId");
CREATE INDEX IF NOT EXISTS "CashReconciliation_status_idx" ON "CashReconciliation"("status");
CREATE INDEX IF NOT EXISTS "CashReconciliation_approvalStatus_idx" ON "CashReconciliation"("approvalStatus");
CREATE INDEX IF NOT EXISTS "CashReconciliation_reconciledAt_idx" ON "CashReconciliation"("reconciledAt");
CREATE INDEX IF NOT EXISTS "CashReconciliation_reconciledById_idx" ON "CashReconciliation"("reconciledById");

CREATE INDEX IF NOT EXISTS "CashLedgerEntry_cashBagId_idx" ON "CashLedgerEntry"("cashBagId");
CREATE INDEX IF NOT EXISTS "CashLedgerEntry_entryType_idx" ON "CashLedgerEntry"("entryType");
CREATE INDEX IF NOT EXISTS "CashLedgerEntry_direction_idx" ON "CashLedgerEntry"("direction");
CREATE INDEX IF NOT EXISTS "CashLedgerEntry_actorId_idx" ON "CashLedgerEntry"("actorId");
CREATE INDEX IF NOT EXISTS "CashLedgerEntry_createdAt_idx" ON "CashLedgerEntry"("createdAt");
CREATE INDEX IF NOT EXISTS "CashLedgerEntry_paymentId_idx" ON "CashLedgerEntry"("paymentId");
CREATE INDEX IF NOT EXISTS "CashLedgerEntry_disbursementId_idx" ON "CashLedgerEntry"("disbursementId");
CREATE INDEX IF NOT EXISTS "CashLedgerEntry_expenseId_idx" ON "CashLedgerEntry"("expenseId");
CREATE INDEX IF NOT EXISTS "CashLedgerEntry_transferId_idx" ON "CashLedgerEntry"("transferId");

-- 12. Seed default ExpenseCategories
INSERT INTO "ExpenseCategory" ("id", "name", "code", "description", "isActive", "createdAt")
VALUES
  (gen_random_uuid()::text, 'Fuel & Travel', 'FUEL', 'Collector fuel, bike petrol, and local travel expenses', true, NOW()),
  (gen_random_uuid()::text, 'Tea & Refreshments', 'REFRESHMENT', 'Food, water, and refreshments during field collection', true, NOW()),
  (gen_random_uuid()::text, 'Office Stationery', 'STATIONERY', 'Receipt books, pens, paper, and printing supplies', true, NOW()),
  (gen_random_uuid()::text, 'Vehicle Maintenance', 'MAINTENANCE', 'Puncture repair, bike service, and operational vehicle upkeep', true, NOW()),
  (gen_random_uuid()::text, 'Miscellaneous Field Expense', 'MISC', 'Other emergency or unforeseen operational expenses', true, NOW())
ON CONFLICT ("code") DO NOTHING;
