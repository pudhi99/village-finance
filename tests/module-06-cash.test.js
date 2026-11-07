/**
 * Module 06 Acceptance & Integrity Tests — Village Finance
 *
 * Verifies:
 * 1. Cash payment and ledger entry commit atomically.
 * 2. UPI payment does not change Cash Bag.
 * 3. Transfer creates balanced paired entries in one transaction.
 * 4. Reversal creates compensating entry; does not delete original.
 * 5. Reconciliation difference requires explanation and approval policy.
 * 6. Expense workflow, separation of duties, and self-approval flagging.
 */
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import {
  deriveCashBagBalance,
  getOrCreateLineCashBag,
  executeRecordCashBagOpening,
  executeInterLineCashTransfer,
  executeRecordExpense,
  executeApproveExpense,
  executeRecordReconciliation,
  executeApproveReconciliation,
  getCashBagDetails,
} from '../src/features/cash/server-actions.js';
import {
  executeRecordPayment,
  executeReversePayment,
} from '../src/features/payments/server-actions.js';
import { getUserSecurityProfile } from '../src/lib/permissions/index.js';

console.log('\n--- Running Module 6: Cash Bag & Cash Ledger Acceptance Tests ---');

async function runTests() {
  const timestamp = Date.now();
  let lineA = null;
  let lineB = null;
  let bagA = null;
  let bagB = null;
  let customer = null;
  let loan = null;
  let cashPayment = null;
  let upiPayment = null;
  let expenseCategory = null;

  try {
    // 1. Fetch Admin Context
    const users = await prisma.userProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { userRoles: { include: { role: true } } },
    });
    const adminUser = users.find((u) =>
      u.userRoles.some((ur) => ur.role.name === 'ADMIN')
    ) || users[0];
    const adminProfile = await getUserSecurityProfile(adminUser.id);
    const adminContext = { profile: adminProfile, user: adminUser };

    // 2. Fetch Village and Loan Scheme
    const village = await prisma.village.findFirst();
    const scheme = await prisma.loanScheme.findFirst({
      where: { code: 'W10K', isActive: true },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1, include: { installmentRules: true } } },
    });
    if (!village || !scheme) throw new Error('Database missing village or W10K scheme for tests');

    const schemeVersion = scheme.versions[0];

    // 3. Create two lines & test customer
    lineA = await prisma.line.create({
      data: {
        name: `Line Alpha ${timestamp}`,
        code: `LA-${String(timestamp).slice(-6)}`,
        weekday: 'MONDAY',
        session: 'MORNING',
      },
    });

    lineB = await prisma.line.create({
      data: {
        name: `Line Beta ${timestamp}`,
        code: `LB-${String(timestamp).slice(-6)}`,
        weekday: 'TUESDAY',
        session: 'AFTERNOON',
      },
    });

    bagA = await getOrCreateLineCashBag(lineA.id);
    bagB = await getOrCreateLineCashBag(lineB.id);

    customer = await prisma.customer.create({
      data: {
        customerNumber: `CUST-MOD6-${timestamp}`,
        fullName: `Cash Test Customer ${timestamp}`,
        villageId: village.id,
        phones: {
          create: [{ phoneNumber: `+9198${String(timestamp).slice(-8)}` }],
        },
        lineAssignments: {
          create: [{ lineId: lineA.id, assignedBy: adminUser.id, isCurrent: true }],
        },
      },
    });

    // 4. Create active loan for customer with installments
    loan = await prisma.loan.create({
      data: {
        loanNumber: `VF-MOD6-LN-${timestamp}`,
        customerId: customer.id,
        schemeId: scheme.id,
        schemeVersionId: schemeVersion.id,
        requestedPrincipalPaise: schemeVersion.principalPaise,
        sanctionedPrincipalPaise: schemeVersion.principalPaise,
        totalFinanceChargePaise: schemeVersion.totalFinanceChargePaise,
        totalRepaymentPaise: schemeVersion.totalRepaymentPaise,
        status: 'ACTIVE',
        applicantId: adminUser.id,
      },
    });

    const schedVersion = await prisma.loanScheduleVersion.create({
      data: {
        loanId: loan.id,
        versionNumber: 1,
        generatedReason: 'INITIAL_DISBURSEMENT',
        totalPrincipalPaise: loan.sanctionedPrincipalPaise,
        totalFinanceChargePaise: loan.totalFinanceChargePaise,
        totalRepaymentPaise: loan.totalRepaymentPaise,
      },
    });

    const baseDueDate = new Date();
    for (const rule of schemeVersion.installmentRules) {
      const dueDate = new Date(baseDueDate);
      dueDate.setDate(dueDate.getDate() + rule.installmentNumber * 7);

      await prisma.loanInstallment.create({
        data: {
          loanId: loan.id,
          scheduleVersionId: schedVersion.id,
          installmentNumber: rule.installmentNumber,
          dueDate,
          totalDuePaise: rule.totalDuePaise,
          principalDuePaise: rule.principalDuePaise,
          financeChargeDuePaise: rule.financeChargeDuePaise,
          totalPaidPaise: 0,
          principalPaidPaise: 0,
          financeChargePaidPaise: 0,
          status: 'PENDING',
        },
      });
    }

    console.log(`✓ Setup: Created Line Alpha & Line Beta, Bag A & Bag B, and active test loan with ${schemeVersion.installmentRules.length} installments.`);

    // -------------------------------------------------------------------------
    // TEST 1: Cash payment and ledger entry commit atomically
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Atomic Cash Payment & Cash Ledger Inflow ---');
    const initialBalanceA = await deriveCashBagBalance(bagA.id);

    const paymentRes = await executeRecordPayment(
      {
        loanId: loan.id,
        amountRupees: 500, // installment amount
        mode: 'CASH',
        lineId: lineA.id,
        notes: 'Regular weekly cash collection',
      },
      adminContext
    );

    assert.equal(paymentRes.success, true);
    cashPayment = paymentRes.payment;
    assert.equal(cashPayment.mode, 'CASH');

    // Verify CashLedgerEntry was created referencing paymentId
    const ledgerEntry = await prisma.cashLedgerEntry.findUnique({
      where: { paymentId: cashPayment.id },
    });
    assert.ok(ledgerEntry, 'CashLedgerEntry must be created atomically with cash payment');
    assert.equal(ledgerEntry.cashBagId, bagA.id);
    assert.equal(ledgerEntry.entryType, 'COLLECTION');
    assert.equal(ledgerEntry.direction, 'IN');
    assert.equal(ledgerEntry.amountPaise, 50000);

    const newBalanceA = await deriveCashBagBalance(bagA.id);
    assert.equal(
      newBalanceA,
      initialBalanceA + 50000,
      'Derived balance must increase by exact payment amount'
    );
    console.log(`✓ Atomic Cash Collection passed: ₹500 payment posted COLLECTION entry (IN) into ${bagA.name}.`);

    // -------------------------------------------------------------------------
    // TEST 2: UPI payment does not change Cash Bag
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: UPI Repayment Cash Isolation ---');
    const preUpiBalance = await deriveCashBagBalance(bagA.id);

    const upiRes = await executeRecordPayment(
      {
        loanId: loan.id,
        amountRupees: 500,
        mode: 'UPI',
        reference: 'UPI-REF-99887766',
        lineId: lineA.id,
        notes: 'Customer paid via Google Pay QR',
      },
      adminContext
    );

    assert.equal(upiRes.success, true);
    upiPayment = upiRes.payment;
    assert.equal(upiPayment.mode, 'UPI');

    // Verify NO cash ledger entry exists for UPI payment
    const upiLedgerEntry = await prisma.cashLedgerEntry.findUnique({
      where: { paymentId: upiPayment.id },
    });
    assert.equal(upiLedgerEntry, null, 'UPI payment must NOT generate a cash ledger entry');

    const postUpiBalance = await deriveCashBagBalance(bagA.id);
    assert.equal(
      postUpiBalance,
      preUpiBalance,
      'Physical cash balance must remain unchanged after UPI payment'
    );
    console.log('✓ UPI Cash Isolation passed: UPI payment allocated dues with ZERO change to physical Cash Bag.');

    // -------------------------------------------------------------------------
    // TEST 3: Inter-Line Transfer creates balanced paired entries in one transaction
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Inter-Line Paired Cash Transfer ---');
    // Seed Bag A with opening balance
    await executeRecordCashBagOpening(
      {
        cashBagId: bagA.id,
        amountRupees: 5000,
        notes: 'Initial operational float',
      },
      adminContext
    );

    const balanceABefore = await deriveCashBagBalance(bagA.id);
    const balanceBBefore = await deriveCashBagBalance(bagB.id);

    const transferRes = await executeInterLineCashTransfer(
      {
        sourceCashBagId: bagA.id,
        destinationCashBagId: bagB.id,
        amountRupees: 2000,
        notes: 'Transfer excess morning float to afternoon line',
      },
      adminContext
    );

    assert.equal(transferRes.success, true);
    const transfer = transferRes.transfer;
    assert.ok(transfer.transferNumber.startsWith('TRF-'));

    // Check paired entries
    assert.equal(transferRes.outEntry.direction, 'OUT');
    assert.equal(transferRes.outEntry.entryType, 'TRANSFER_OUT');
    assert.equal(transferRes.outEntry.cashBagId, bagA.id);

    assert.equal(transferRes.inEntry.direction, 'IN');
    assert.equal(transferRes.inEntry.entryType, 'TRANSFER_IN');
    assert.equal(transferRes.inEntry.cashBagId, bagB.id);

    const balanceAAfter = await deriveCashBagBalance(bagA.id);
    const balanceBAfter = await deriveCashBagBalance(bagB.id);

    assert.equal(balanceAAfter, balanceABefore - 200000, 'Source bag must decrease by ₹2,000');
    assert.equal(balanceBAfter, balanceBBefore + 200000, 'Destination bag must increase by ₹2,000');

    console.log(`✓ Paired Transfer passed: ${transfer.transferNumber} transferred ₹2,000 with net 0 system change.`);

    // -------------------------------------------------------------------------
    // TEST 4: Reversal creates compensating entry; does not delete original
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Compensating Cash Reversal ---');
    const balanceBeforeReversal = await deriveCashBagBalance(bagA.id);

    const reversalRes = await executeReversePayment(
      {
        paymentId: cashPayment.id,
        reason: 'Payment collected on wrong line bag, reversing',
      },
      adminContext
    );

    assert.equal(reversalRes.success, true);

    // Verify original COLLECTION entry still exists (append-only integrity)
    const originalStillExists = await prisma.cashLedgerEntry.findUnique({
      where: { paymentId: cashPayment.id },
    });
    assert.ok(originalStillExists, 'Original COLLECTION entry must remain immutable');

    // Verify compensating REVERSAL entry exists
    const reversalEntry = await prisma.cashLedgerEntry.findFirst({
      where: {
        cashBagId: bagA.id,
        entryType: 'REVERSAL',
        direction: 'OUT',
        amountPaise: 50000,
      },
    });
    assert.ok(reversalEntry, 'Compensating REVERSAL entry (OUT) must be posted');

    const balanceAfterReversal = await deriveCashBagBalance(bagA.id);
    assert.equal(
      balanceAfterReversal,
      balanceBeforeReversal - 50000,
      'Balance must accurately reflect reversal deduction'
    );
    console.log('✓ Compensating Reversal passed: Original entry preserved; REVERSAL (OUT) posted atomically.');

    // -------------------------------------------------------------------------
    // TEST 5: Reconciliation difference requires explanation and approval policy
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Cash Reconciliation & Discrepancy Policy ---');
    const currentExpected = await deriveCashBagBalance(bagA.id);

    // Attempting reconciliation with difference and missing reason must fail
    let missingReasonBlocked = false;
    try {
      await executeRecordReconciliation(
        {
          cashBagId: bagA.id,
          actualBalanceRupees: (currentExpected / 100) - 100, // ₹100 shortage
          reason: '', // Missing reason!
        },
        adminContext
      );
    } catch (err) {
      missingReasonBlocked = true;
      assert.match(err.message, /explanation is strictly required/);
    }
    assert.equal(missingReasonBlocked, true, 'Reconciliation discrepancy without reason must throw error');

    // Recording with documented reason creates PENDING reconciliation
    const reconRes = await executeRecordReconciliation(
      {
        cashBagId: bagA.id,
        actualBalanceRupees: (currentExpected / 100) - 100, // ₹100 shortage
        reason: 'Unaccounted small change mismatch during evening rush',
      },
      adminContext
    );

    assert.equal(reconRes.success, true);
    const recon = reconRes.reconciliation;
    assert.equal(recon.status, 'SHORTAGE');
    assert.equal(recon.differencePaise, -10000); // -₹100
    assert.equal(recon.approvalStatus, 'PENDING');

    // Before approval, NO adjustment entry should be posted
    const preApprovalBalance = await deriveCashBagBalance(bagA.id);
    assert.equal(preApprovalBalance, currentExpected, 'Pending reconciliation must not alter ledger balance');

    // Admin approves reconciliation discrepancy
    const approveReconRes = await executeApproveReconciliation(
      {
        reconciliationId: recon.id,
        approved: true,
        approvalNotes: 'Approved after verification with line collector',
      },
      adminContext
    );

    assert.equal(approveReconRes.success, true);
    assert.ok(approveReconRes.ledgerEntry, 'ADJUSTMENT entry must be posted upon approval');
    assert.equal(approveReconRes.ledgerEntry.entryType, 'ADJUSTMENT');
    assert.equal(approveReconRes.ledgerEntry.direction, 'OUT'); // shortage deduction
    assert.equal(approveReconRes.ledgerEntry.amountPaise, 10000);

    const postReconBalance = await deriveCashBagBalance(bagA.id);
    assert.equal(
      postReconBalance,
      currentExpected - 10000,
      'Post-approval balance must match physical count'
    );
    console.log('✓ Reconciliation Policy passed: Shortage required reason, created PENDING status, and posted ADJUSTMENT on approval.');

    // -------------------------------------------------------------------------
    // TEST 6: Field Expense & Self-Approval Flagging
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Field Expense & Self-Approval Flagging ---');
    expenseCategory = await prisma.expenseCategory.findFirst({ where: { code: 'FUEL' } });
    if (!expenseCategory) {
      expenseCategory = await prisma.expenseCategory.create({
        data: { name: 'Fuel & Travel Test', code: 'FUEL_TEST' },
      });
    }

    // Admin records and self-approves expense
    const expenseRes = await executeRecordExpense(
      {
        cashBagId: bagA.id,
        categoryId: expenseCategory.id,
        amountRupees: 250,
        description: 'Bike petrol for rural customer route',
        autoApprove: true,
      },
      adminContext
    );

    assert.equal(expenseRes.success, true);
    const expense = expenseRes.expense;
    assert.equal(expense.approvalStatus, 'APPROVED');
    assert.equal(expense.isSelfApproved, true, 'Expense recorded and approved by same user must have isSelfApproved = true');
    assert.ok(expenseRes.ledgerEntry, 'Approved expense must post EXPENSE ledger entry');
    assert.equal(expenseRes.ledgerEntry.direction, 'OUT');
    assert.equal(expenseRes.ledgerEntry.amountPaise, 25000);

    console.log('✓ Field Expense passed: ₹250 expense approved with isSelfApproved flagged and EXPENSE (OUT) entry committed.');

    console.log('\n======================================================');
    console.log('✅ ALL MODULE 06 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    // Cleanup test records
    if (loan) {
      await prisma.cashLedgerEntry.deleteMany({ where: { payment: { loanId: loan.id } } }).catch(() => {});
      await prisma.paymentAllocation.deleteMany({ where: { loanId: loan.id } }).catch(() => {});
      await prisma.paymentReversal.deleteMany({ where: { payment: { loanId: loan.id } } }).catch(() => {});
      await prisma.payment.deleteMany({ where: { loanId: loan.id } }).catch(() => {});
      await prisma.loanInstallment.deleteMany({ where: { loanId: loan.id } }).catch(() => {});
      await prisma.loanDisbursement.deleteMany({ where: { loanId: loan.id } }).catch(() => {});
      await prisma.loanScheduleVersion.deleteMany({ where: { loanId: loan.id } }).catch(() => {});
      await prisma.loan.delete({ where: { id: loan.id } }).catch(() => {});
    }
    if (customer) {
      await prisma.customerPhone.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
      await prisma.customerLineAssignment.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
      await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
    }
    if (bagA) {
      await prisma.cashLedgerEntry.deleteMany({ where: { cashBagId: bagA.id } }).catch(() => {});
      await prisma.cashReconciliation.deleteMany({ where: { cashBagId: bagA.id } }).catch(() => {});
      await prisma.cashHandover.deleteMany({ where: { cashBagId: bagA.id } }).catch(() => {});
      await prisma.expense.deleteMany({ where: { cashBagId: bagA.id } }).catch(() => {});
      await prisma.cashBagOpening.deleteMany({ where: { cashBagId: bagA.id } }).catch(() => {});
      await prisma.cashTransfer.deleteMany({ where: { OR: [{ sourceCashBagId: bagA.id }, { destinationCashBagId: bagA.id }] } }).catch(() => {});
      await prisma.cashBag.delete({ where: { id: bagA.id } }).catch(() => {});
    }
    if (bagB) {
      await prisma.cashLedgerEntry.deleteMany({ where: { cashBagId: bagB.id } }).catch(() => {});
      await prisma.cashReconciliation.deleteMany({ where: { cashBagId: bagB.id } }).catch(() => {});
      await prisma.cashHandover.deleteMany({ where: { cashBagId: bagB.id } }).catch(() => {});
      await prisma.expense.deleteMany({ where: { cashBagId: bagB.id } }).catch(() => {});
      await prisma.cashBagOpening.deleteMany({ where: { cashBagId: bagB.id } }).catch(() => {});
      await prisma.cashTransfer.deleteMany({ where: { OR: [{ sourceCashBagId: bagB.id }, { destinationCashBagId: bagB.id }] } }).catch(() => {});
      await prisma.cashBag.delete({ where: { id: bagB.id } }).catch(() => {});
    }
    if (lineA) await prisma.line.delete({ where: { id: lineA.id } }).catch(() => {});
    if (lineB) await prisma.line.delete({ where: { id: lineB.id } }).catch(() => {});

    await prisma.$disconnect().catch(() => {});
  }
}

runTests().then(() => {
  process.exit(0);
}).catch(async (e) => {
  console.error('\n❌ MODULE 06 TEST FAILED:', e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
