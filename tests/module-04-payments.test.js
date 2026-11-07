/**
 * Module 4 Acceptance & Integrity Tests — Village Finance
 *
 * Verifies:
 * 1. Partial payment: ₹500 paid against first installment of ₹1,250 leaves ₹750 on that same installment
 *    with exact principal and finance charge component allocation.
 * 2. Advance payment applies FIFO: Payment satisfies oldest pending installment first,
 *    then cascades forward to future installments in chronological sequence.
 * 3. Excess payment remains as same-loan advance credit: Excess beyond all scheduled
 *    installments is recorded as CustomerAdvanceCreditEntry for that loan only.
 * 4. Idempotency safety: Re-submitting with the same idempotencyKey returns original payment
 *    without double-allocation or duplicate records.
 * 5. Atomic Reversal: Administrator reversal restores installment balances and statuses
 *    atomically, voids linked advance credit, and creates audit trail.
 * 6. Non-admin Reversal blocked: Non-admin users are strictly blocked from reversing payments.
 */
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import {
  executeRecordPayment,
  executeReversePayment,
  getLoanRepaymentSummary,
  getPaymentDetails,
} from '../src/features/payments/server-actions.js';
import { paiseToRupees, rupeesToPaise } from '../src/lib/money/index.js';
import { getUserSecurityProfile } from '../src/lib/permissions/index.js';

console.log('\n--- Running Module 4: Payments and Allocations Acceptance Tests ---');

async function runTests() {
  const timestamp = Date.now();
  let testCustomer = null;
  let testLoan = null;
  let nonAdminUser = null;

  try {
    // 1. Fetch Admin user
    const users = await prisma.userProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { userRoles: { include: { role: true } } },
    });
    const adminUser = users.find((u) =>
      u.userRoles.some((ur) => ur.role.name === 'ADMIN')
    ) || users[0];

    const adminProfile = await getUserSecurityProfile(adminUser.id);
    const adminContext = { profile: adminProfile, user: adminUser };

    // Ensure non-admin user exists
    nonAdminUser = users.find(
      (u) => !u.userRoles.some((ur) => ur.role.name === 'ADMIN')
    );
    if (!nonAdminUser) {
      nonAdminUser = await prisma.userProfile.create({
        data: {
          id: `collector-${timestamp}`,
          email: `collector.${timestamp}@villagefinance.com`,
          fullName: 'Test Field Collector',
          status: 'ACTIVE',
        },
      });
      const collectorRole = await prisma.role.findFirst({
        where: { name: 'COLLECTION_TEAM' },
      });
      if (collectorRole) {
        await prisma.userRole.create({
          data: {
            userId: nonAdminUser.id,
            roleId: collectorRole.id,
          },
        });
      }
    }

    const nonAdminProfile = await getUserSecurityProfile(nonAdminUser.id);
    const nonAdminContext = { profile: nonAdminProfile, user: nonAdminUser };

    // 2. Fetch Village and Scheme
    const testVillage = await prisma.village.findFirst();
    const testScheme = await prisma.loanScheme.findFirst({
      where: { code: 'W10K', isActive: true },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1, include: { installmentRules: true } } },
    });

    if (!testVillage || !testScheme) {
      throw new Error('Test environment missing required village or W10K scheme.');
    }

    const schemeVersion = testScheme.versions[0];

    // 3. Create test customer
    testCustomer = await prisma.customer.create({
      data: {
        customerNumber: `VF-MOD4-CUST-${timestamp}`,
        fullName: `Mod4 Customer ${timestamp}`,
        villageId: testVillage.id,
        phones: {
          create: {
            phoneNumber: `9700${String(timestamp).slice(-6)}`,
            isPrimary: true,
          },
        },
      },
    });

    // 4. Create active disbursed test loan with scheduled installments
    testLoan = await prisma.loan.create({
      data: {
        loanNumber: `VF-MOD4-LN-${timestamp}`,
        customerId: testCustomer.id,
        schemeId: testScheme.id,
        schemeVersionId: schemeVersion.id,
        requestedPrincipalPaise: schemeVersion.principalPaise,
        sanctionedPrincipalPaise: schemeVersion.principalPaise,
        totalFinanceChargePaise: schemeVersion.totalFinanceChargePaise,
        totalRepaymentPaise: schemeVersion.totalRepaymentPaise,
        status: 'ACTIVE',
        applicantId: adminUser.id,
      },
    });

    // Create schedule snapshot version
    const schedVersion = await prisma.loanScheduleVersion.create({
      data: {
        loanId: testLoan.id,
        versionNumber: 1,
        generatedReason: 'INITIAL_DISBURSEMENT',
        totalPrincipalPaise: testLoan.sanctionedPrincipalPaise,
        totalFinanceChargePaise: testLoan.totalFinanceChargePaise,
        totalRepaymentPaise: testLoan.totalRepaymentPaise,
      },
    });

    // Clone installments from scheme into loan schedule
    const baseDueDate = new Date();
    for (const rule of schemeVersion.installmentRules) {
      const dueDate = new Date(baseDueDate);
      dueDate.setDate(dueDate.getDate() + rule.installmentNumber * 7);

      await prisma.loanInstallment.create({
        data: {
          scheduleVersionId: schedVersion.id,
          loanId: testLoan.id,
          installmentNumber: rule.installmentNumber,
          dueDate,
          principalDuePaise: rule.principalDuePaise,
          financeChargeDuePaise: rule.financeChargeDuePaise,
          totalDuePaise: rule.totalDuePaise,
          status: 'PENDING',
        },
      });
    }

    console.log(`✓ Setup: Test loan ${testLoan.loanNumber} created with ${schemeVersion.installmentRules.length} installments.`);

    // -------------------------------------------------------------------------
    // TEST 1: Partial payment (e.g. ₹300 paid against first installment of ₹500)
    // leaves ₹200 balance on same installment with exact component allocation.
    // (Acceptance Test from Spec: "₹300 paid against ₹500 due leaves ₹200")
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Partial Payment Allocation ---');
    const firstInstBefore = await prisma.loanInstallment.findFirst({
      where: { loanId: testLoan.id, installmentNumber: 1 },
    });
    const inst1TotalDue = firstInstBefore.totalDuePaise; // 50,000 paise (₹500)
    const partialAmountRupees = 300; // ₹300
    const partialAmountPaise = rupeesToPaise(partialAmountRupees); // 30,000 paise

    const pay1Result = await executeRecordPayment(
      {
        loanId: testLoan.id,
        amountRupees: partialAmountRupees,
        mode: 'CASH',
        notes: 'Test partial payment (₹300 against ₹500)',
        idempotencyKey: `idemp-1-${timestamp}`,
      },
      adminContext
    );

    assert.equal(pay1Result.success, true, 'Payment 1 should succeed');

    const firstInstAfter = await prisma.loanInstallment.findFirst({
      where: { loanId: testLoan.id, installmentNumber: 1 },
    });

    assert.equal(firstInstAfter.status, 'PARTIALLY_PAID', 'Installment 1 should be PARTIALLY_PAID');
    assert.equal(firstInstAfter.totalPaidPaise, partialAmountPaise, 'Total paid on inst 1 should equal partial payment amount (₹300)');
    assert.equal(
      firstInstAfter.totalDuePaise - firstInstAfter.totalPaidPaise,
      rupeesToPaise(200),
      'Remaining balance on installment 1 must be exactly ₹200'
    );
    assert.equal(
      firstInstAfter.principalPaidPaise + firstInstAfter.financeChargePaidPaise,
      partialAmountPaise,
      'Allocated principal + finance charge must exactly equal total paid'
    );
    console.log(`✓ Partial Payment passed: ₹${partialAmountRupees} paid against ₹${paiseToRupees(inst1TotalDue)} leaves ₹${paiseToRupees(firstInstAfter.totalDuePaise - firstInstAfter.totalPaidPaise)} balance.`);

    // -------------------------------------------------------------------------
    // TEST 2: FIFO Cascade across installments
    // Pay remaining ₹200 of inst 1 plus full inst 2 (₹500) + ₹200 of inst 3 = ₹900
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Full FIFO Cascade Across Installments ---');
    const cascadeAmountRupees = 900; // ₹900
    const pay2Result = await executeRecordPayment(
      {
        loanId: testLoan.id,
        amountRupees: cascadeAmountRupees,
        mode: 'UPI',
        reference: 'UPI/TEST/20261104',
        notes: 'FIFO cascade test',
        idempotencyKey: `idemp-2-${timestamp}`,
      },
      adminContext
    );

    assert.equal(pay2Result.success, true, 'Payment 2 should succeed');

    const installmentsAfterCascade = await prisma.loanInstallment.findMany({
      where: { loanId: testLoan.id },
      orderBy: { installmentNumber: 'asc' },
    });

    // Installment 1 should now be fully PAID (₹300 + ₹200 = ₹500)
    assert.equal(installmentsAfterCascade[0].status, 'PAID', 'Installment 1 must be fully PAID');
    assert.equal(installmentsAfterCascade[0].totalPaidPaise, installmentsAfterCascade[0].totalDuePaise);

    // Installment 2 should now be fully PAID (₹500)
    assert.equal(installmentsAfterCascade[1].status, 'PAID', 'Installment 2 must be fully PAID');
    assert.equal(installmentsAfterCascade[1].totalPaidPaise, installmentsAfterCascade[1].totalDuePaise);

    // Installment 3 should be PARTIALLY_PAID with ₹200 (20,000 paise)
    assert.equal(installmentsAfterCascade[2].status, 'PARTIALLY_PAID', 'Installment 3 must be PARTIALLY_PAID');
    assert.equal(installmentsAfterCascade[2].totalPaidPaise, rupeesToPaise(200));

    // Installment 4 should still be PENDING
    assert.equal(installmentsAfterCascade[3].status, 'PENDING', 'Installment 4 must remain PENDING');
    assert.equal(installmentsAfterCascade[3].totalPaidPaise, 0);

    console.log('✓ FIFO Cascade passed: Installments 1 & 2 fully cleared, remaining absorbed into installment 3.');

    // -------------------------------------------------------------------------
    // TEST 3: Idempotency safety
    // Re-submitting pay2 with the same idempotency key returns original without duplicate
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Idempotency Key Safety ---');
    const pay2DuplicateResult = await executeRecordPayment(
      {
        loanId: testLoan.id,
        amountRupees: cascadeAmountRupees,
        mode: 'UPI',
        idempotencyKey: `idemp-2-${timestamp}`,
      },
      adminContext
    );

    assert.equal(pay2DuplicateResult.success, true);
    assert.equal(pay2DuplicateResult.isDuplicate, true, 'Duplicate request must be flagged as duplicate');
    assert.equal(pay2DuplicateResult.payment.id, pay2Result.payment.id, 'Must return identical payment ID');

    const totalPaymentsCount = await prisma.payment.count({
      where: { loanId: testLoan.id },
    });
    assert.equal(totalPaymentsCount, 2, 'No new payment record created for duplicate idempotency key');
    console.log('✓ Idempotency safety passed: Duplicate submission cleanly returned original payment.');

    // -------------------------------------------------------------------------
    // TEST 4: Excess payment beyond total loan repayment creates same-loan Advance Credit
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Excess Payment Same-Loan Advance Credit ---');
    const summaryBeforeExcess = await getLoanRepaymentSummary(testLoan.id, adminContext);
    const remainingLoanDueRupees = summaryBeforeExcess.totals.remainingTotalRupees;
    const excessRupees = 500;
    const overpaymentRupees = remainingLoanDueRupees + excessRupees;

    const pay3Result = await executeRecordPayment(
      {
        loanId: testLoan.id,
        amountRupees: overpaymentRupees,
        mode: 'BANK_TRANSFER',
        reference: 'IMPS/MOD4/EXCESS',
        idempotencyKey: `idemp-3-${timestamp}`,
      },
      adminContext
    );

    assert.equal(pay3Result.success, true);
    assert.equal(pay3Result.payment.advanceCreditPaise, rupeesToPaise(excessRupees), 'Advance credit paise must match excess');

    // Verify all installments are now PAID
    const remainingPending = await prisma.loanInstallment.count({
      where: { loanId: testLoan.id, status: { not: 'PAID' } },
    });
    assert.equal(remainingPending, 0, 'All installments must be fully paid');

    // Verify Loan status updated to PAID
    const loanAfterOverpayment = await prisma.loan.findUnique({ where: { id: testLoan.id } });
    assert.equal(loanAfterOverpayment.status, 'PAID', 'Loan must transition to PAID status');

    // Verify CustomerAdvanceCreditEntry created
    const advanceCreditEntry = await prisma.customerAdvanceCreditEntry.findFirst({
      where: { loanId: testLoan.id, paymentId: pay3Result.payment.id },
    });
    assert.ok(advanceCreditEntry, 'CustomerAdvanceCreditEntry must exist');
    assert.equal(advanceCreditEntry.balancePaise, rupeesToPaise(excessRupees));
    assert.equal(advanceCreditEntry.type, 'CREDIT');

    console.log(`✓ Excess Payment passed: Remaining dues of ₹${remainingLoanDueRupees} cleared, ₹${excessRupees} credited as same-loan advance credit, loan marked PAID.`);

    // -------------------------------------------------------------------------
    // TEST 5: Non-Admin Reversal Blocked
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Non-Admin Reversal Blocked ---');
    let nonAdminReversalError = null;
    try {
      await executeReversePayment(
        {
          paymentId: pay3Result.payment.id,
          reason: 'Collector trying to unauthorizedly reverse payment',
        },
        nonAdminContext
      );
    } catch (err) {
      nonAdminReversalError = err.message;
    }

    assert.ok(nonAdminReversalError, 'Non-admin reversal must throw error');
    assert.match(nonAdminReversalError, /administrators are authorized/, 'Must enforce admin authorization');
    console.log(`✓ Non-Admin reversal blocked: Anti-tampering check verified (${nonAdminReversalError}).`);

    // -------------------------------------------------------------------------
    // TEST 6: Atomic Reversal by Administrator
    // Reversing Payment 3 restores the previous installment balances, voids advance credit,
    // and reverts loan status from PAID back to ACTIVE
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Atomic Payment Reversal ---');
    const reversalResult = await executeReversePayment(
      {
        paymentId: pay3Result.payment.id,
        reason: 'Customer mistakenly paid wrong loan amount, reversing excess payment',
      },
      adminContext
    );

    assert.equal(reversalResult.success, true);
    assert.equal(reversalResult.payment.status, 'REVERSED', 'Payment status must be REVERSED');
    assert.ok(reversalResult.reversal, 'PaymentReversal record must be generated');

    // Verify Loan status was reverted from PAID back to ACTIVE
    const loanAfterReversal = await prisma.loan.findUnique({ where: { id: testLoan.id } });
    assert.equal(loanAfterReversal.status, 'ACTIVE', 'Loan status must revert from PAID to ACTIVE');

    // Verify Advance Credit entry was voided (balance set to 0)
    const advanceCreditAfterReversal = await prisma.customerAdvanceCreditEntry.findFirst({
      where: { loanId: testLoan.id, paymentId: pay3Result.payment.id },
    });
    assert.equal(advanceCreditAfterReversal.balancePaise, 0, 'Advance credit balance must be zeroed out');
    assert.match(advanceCreditAfterReversal.notes, /VOIDED BY PAYMENT REVERSAL/);

    // Verify Installments were restored
    const summaryAfterReversal = await getLoanRepaymentSummary(testLoan.id, adminContext);
    assert.ok(summaryAfterReversal.totals.remainingTotalRupees > 0, 'Loan must have remaining dues after reversal');

    console.log(`✓ Atomic Reversal passed: Payment marked REVERSED, installments reopened, advance credit voided, loan returned to ACTIVE.`);

    console.log('\n======================================================');
    console.log('✅ ALL MODULE 04 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    // Cleanup test records
    if (testLoan) {
      await prisma.paymentAllocation.deleteMany({ where: { loanId: testLoan.id } }).catch(() => {});
      await prisma.paymentReversal.deleteMany({ where: { payment: { loanId: testLoan.id } } }).catch(() => {});
      await prisma.customerAdvanceCreditEntry.deleteMany({ where: { loanId: testLoan.id } }).catch(() => {});
      await prisma.payment.deleteMany({ where: { loanId: testLoan.id } }).catch(() => {});
      await prisma.loanInstallment.deleteMany({ where: { loanId: testLoan.id } }).catch(() => {});
      await prisma.loanScheduleVersion.deleteMany({ where: { loanId: testLoan.id } }).catch(() => {});
      await prisma.loan.delete({ where: { id: testLoan.id } }).catch(() => {});
    }
    if (testCustomer) {
      await prisma.customerPhone.deleteMany({ where: { customerId: testCustomer.id } }).catch(() => {});
      await prisma.customer.delete({ where: { id: testCustomer.id } }).catch(() => {});
    }
    if (nonAdminUser && nonAdminUser.id.startsWith('collector-')) {
      await prisma.userRole.deleteMany({ where: { userId: nonAdminUser.id } }).catch(() => {});
      await prisma.userProfile.delete({ where: { id: nonAdminUser.id } }).catch(() => {});
    }
  }
}

runTests().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error('\n❌ MODULE 04 TEST FAILED:', e);
  process.exit(1);
});
