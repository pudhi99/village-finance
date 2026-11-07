/**
 * Module 07 Acceptance Test Suite — Village Finance
 *
 * Covers all required acceptance tests from 12-MODULE-PARTNERS-CAPITAL-PROFIT-LOSS.md:
 * 1. Historical distribution does not change after ratio update.
 * 2. Capital contribution and Cash Bag deposit remain separate.
 * 3. Principal repayment is excluded from profit calculation.
 * 4. No distribution can be posted without a defined approved profit period.
 * 5. Partner withdrawal reduces capital only when actually paid.
 * 6. Partner capital balance is authoritative and dynamically derived without drift.
 */

import assert from 'node:assert';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';
import {
  executeCreatePartner,
  executeSetPartnerRatio,
  executeRecordCapitalContribution,
  executeRequestPartnerWithdrawal,
  executeApprovePartnerWithdrawal,
  executePayoutPartnerWithdrawal,
  executeCalculateProfitPeriod,
  executeApproveProfitPeriod,
  executePostProfitDistribution,
  derivePartnerCapitalBalance,
  getActivePartnerRatio,
} from '../src/features/partners/server-actions.js';
import { getOrCreateLineCashBag, deriveCashBagBalance } from '../src/features/cash/server-actions.js';
import { executeRecordPayment } from '../src/features/payments/server-actions.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const timestamp = Date.now();

let adminUser;
let testPartner1;
let testPartner2;
let testLine;
let testCashBag;
let testCustomer;
let testLoan;

async function setup() {
  console.log('\n--- Running Module 7: Partners, Capital, Profit & Loss Acceptance Tests ---');

  adminUser = await prisma.userProfile.findFirst({
    where: { userRoles: { some: { role: { name: 'ADMIN' } } } },
  });

  if (!adminUser) {
    adminUser = await prisma.userProfile.create({
      data: {
        id: `admin-mod7-${timestamp}`,
        email: `admin-mod7-${timestamp}@villagefinance.local`,
        fullName: 'Module 7 Test Admin',
        status: 'ACTIVE',
      },
    });
  }

  // Clean up previous test partners so active ratios sum strictly to 100%
  await prisma.partner.deleteMany({
    where: { partnerCode: { startsWith: 'PRT-' } },
  });

  const actorContext = { id: adminUser.id, isAdmin: true };

  // Create two test partners effective from start of 2026
  testPartner1 = await executeCreatePartner({
    name: `Partner Rajesh ${timestamp}`,
    partnerCode: `PRT-R${String(timestamp).slice(-4)}`,
    capitalRatio: 60,
    profitRatio: 60,
    lossRatio: 60,
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  }, actorContext);

  testPartner2 = await executeCreatePartner({
    name: `Partner Suresh ${timestamp}`,
    partnerCode: `PRT-S${String(timestamp).slice(-4)}`,
    capitalRatio: 40,
    profitRatio: 40,
    lossRatio: 40,
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  }, actorContext);

  // Setup test line and cash bag
  testLine = await prisma.line.create({
    data: {
      name: `Partner Test Line ${timestamp}`,
      code: `LN-P${String(timestamp).slice(-4)}`,
      weekday: 'SUNDAY',
      session: 'MORNING',
    },
  });

  testCashBag = await getOrCreateLineCashBag(testLine.id);

  console.log(`✓ Setup: Created Partners ${testPartner1.name} (60%) & ${testPartner2.name} (40%), and Cash Bag.`);
}

async function test1_HistoricalDistributionImmutable() {
  console.log('\n--- Test 1: Historical Distribution Ratio Snapshot Immutability ---');
  const actorContext = { id: adminUser.id, isAdmin: true };

  // Create and approve a test profit period
  const startDate = new Date('2026-01-01T00:00:00Z');
  const endDate = new Date('2026-01-31T23:59:59Z');
  const periodCode = `PRF-JAN-${timestamp}`;

  const period = await prisma.profitPeriod.create({
    data: {
      periodCode,
      name: `January 2026 Profit Period ${timestamp}`,
      startDate,
      endDate,
      status: 'APPROVED', // Pre-approved for this distribution test
      totalFinanceChargeCollectedPaise: 100000, // ₹1,000 finance charge
      totalApprovedExpensesPaise: 20000,        // ₹200 expenses
      netProfitPaise: 80000,                    // ₹800 net profit
      retainedEarningsPaise: 0,
      distributableProfitPaise: 80000,          // ₹800 distributable
      approvedById: adminUser.id,
      approvedAt: new Date(),
    },
  });

  // Post profit distribution with current 60/40 ratio
  const distribution = await executePostProfitDistribution({
    profitPeriodId: period.id,
    notes: 'Distribution under initial 60/40 ratio',
  }, actorContext);

  const detail1 = distribution.details.find((d) => d.partnerId === testPartner1.id);
  const detail2 = distribution.details.find((d) => d.partnerId === testPartner2.id);

  assert.strictEqual(Number(detail1.profitRatioSnapshot), 60);
  assert.strictEqual(detail1.allocatedSharePaise, 48000); // 60% of ₹800 = ₹480

  assert.strictEqual(Number(detail2.profitRatioSnapshot), 40);
  assert.strictEqual(detail2.allocatedSharePaise, 32000); // 40% of ₹800 = ₹320

  // Now, update ratios to 50/50 effective immediately
  await executeSetPartnerRatio({
    partnerId: testPartner1.id,
    capitalRatio: 50,
    profitRatio: 50,
    lossRatio: 50,
    effectiveFrom: new Date(),
  }, actorContext);

  await executeSetPartnerRatio({
    partnerId: testPartner2.id,
    capitalRatio: 50,
    profitRatio: 50,
    lossRatio: 50,
    effectiveFrom: new Date(),
  }, actorContext);

  // Re-fetch historical distribution from DB
  const historicalDist = await prisma.profitDistribution.findUnique({
    where: { id: distribution.id },
    include: { details: true },
  });

  const histDetail1 = historicalDist.details.find((d) => d.partnerId === testPartner1.id);
  const histDetail2 = historicalDist.details.find((d) => d.partnerId === testPartner2.id);

  // Assert snapshot immutability
  assert.strictEqual(Number(histDetail1.profitRatioSnapshot), 60, 'Historical ratio snapshot must NOT change!');
  assert.strictEqual(histDetail1.allocatedSharePaise, 48000, 'Historical allocated share must NOT change!');

  assert.strictEqual(Number(histDetail2.profitRatioSnapshot), 40, 'Historical ratio snapshot must NOT change!');
  assert.strictEqual(histDetail2.allocatedSharePaise, 32000, 'Historical allocated share must NOT change!');

  console.log('✓ Historical distribution immutability passed: Modifying ratios preserved past distribution snapshot (60% / 40%).');
}

async function test2_CapitalContributionAndCashBagSeparation() {
  console.log('\n--- Test 2: Capital Contribution & Cash Bag Deposit Separation ---');
  const actorContext = { id: adminUser.id, isAdmin: true };

  const initialCapital = await derivePartnerCapitalBalance(testPartner1.id);
  const initialCash = await deriveCashBagBalance(testCashBag.id);

  // 1. Record capital contribution via Bank Transfer (No cash bag deposit)
  const bankContributionPaise = 500000; // ₹5,000
  await executeRecordCapitalContribution({
    partnerId: testPartner1.id,
    amountPaise: bankContributionPaise,
    entryType: 'ADDITIONAL_CONTRIBUTION',
    paymentMode: 'BANK_TRANSFER',
    reference: 'NEFT-AXIS-99281',
  }, actorContext);

  const capitalAfterBank = await derivePartnerCapitalBalance(testPartner1.id);
  const cashAfterBank = await deriveCashBagBalance(testCashBag.id);

  assert.strictEqual(capitalAfterBank, initialCapital + bankContributionPaise, 'Partner capital must reflect contribution');
  assert.strictEqual(cashAfterBank, initialCash, 'Physical cash bag balance must be UNCHANGED by bank capital contribution');

  // 2. Record capital contribution deposited into Cash Bag
  const cashContributionPaise = 200000; // ₹2,000
  const cashEntry = await executeRecordCapitalContribution({
    partnerId: testPartner1.id,
    amountPaise: cashContributionPaise,
    entryType: 'ADDITIONAL_CONTRIBUTION',
    paymentMode: 'CASH',
    depositToCashBagId: testCashBag.id,
    notes: 'Physical cash capital injection into Line Cash Bag',
  }, actorContext);

  const capitalAfterCash = await derivePartnerCapitalBalance(testPartner1.id);
  const cashAfterCash = await deriveCashBagBalance(testCashBag.id);

  assert.strictEqual(capitalAfterCash, capitalAfterBank + cashContributionPaise, 'Partner capital must increase');
  assert.strictEqual(cashAfterCash, initialCash + cashContributionPaise, 'Cash bag must increase by physical deposit');
  assert.ok(cashEntry.cashLedgerEntryId, 'Linked cash ledger entry ID must exist for physical cash deposit');

  console.log('✓ Capital & Cash Bag separation passed: Bank contribution isolated from Cash Bag; Cash contribution linked properly.');
}

async function test3_PrincipalRepaymentExcludedFromProfit() {
  console.log('\n--- Test 3: Principal Repayment Excluded From Profit Calculation ---');
  const actorContext = { id: adminUser.id, isAdmin: true };

  // Setup village & customer for payment allocation
  const village = await prisma.village.create({
    data: { name: `Mod7 Village ${timestamp}`, code: `V-M7-${String(timestamp).slice(-4)}` },
  });
  const area = await prisma.area.create({
    data: { name: `Mod7 Area ${timestamp}`, villageId: village.id },
  });
  testCustomer = await prisma.customer.create({
    data: {
      customerNumber: `VF-MOD7-CUST-${timestamp}`,
      fullName: `ProfitTest Customer ${timestamp}`,
      villageId: village.id,
      areaId: area.id,
      phones: { create: { phoneNumber: `9700${String(timestamp).slice(-6)}`, isPrimary: true } },
    },
  });

  const scheme = await prisma.loanScheme.findFirst({
    where: { code: 'W10K' },
    include: { versions: { take: 1 } },
  });

  testLoan = await prisma.loan.create({
    data: {
      loanNumber: `VF-MOD7-LN-${timestamp}`,
      customerId: testCustomer.id,
      schemeId: scheme.id,
      schemeVersionId: scheme.versions[0].id,
      requestedPrincipalPaise: 1000000,
      sanctionedPrincipalPaise: 1000000,
      totalFinanceChargePaise: 250000,
      totalRepaymentPaise: 1250000,
      status: 'ACTIVE',
      applicantId: adminUser.id,
    },
  });

  // Create installment where ₹400 is Principal and ₹100 is Finance Charge
  const schedVersion = await prisma.loanScheduleVersion.create({
    data: {
      loanId: testLoan.id,
      versionNumber: 1,
      generatedReason: 'INITIAL_DISBURSEMENT',
      totalPrincipalPaise: 1000000,
      totalFinanceChargePaise: 250000,
      totalRepaymentPaise: 1250000,
    },
  });

  await prisma.loanInstallment.create({
    data: {
      loanId: testLoan.id,
      scheduleVersionId: schedVersion.id,
      installmentNumber: 1,
      dueDate: new Date(),
      totalDuePaise: 50000,
      principalDuePaise: 40000,
      financeChargeDuePaise: 10000,
      status: 'PENDING',
    },
  });

  // Record a ₹500 payment on this loan in an isolated unique period window
  const testYear = 2030 + (timestamp % 500);
  const start = new Date(`${testYear}-06-01T00:00:00Z`);
  const end = new Date(`${testYear}-06-30T23:59:59Z`);
  const paymentDateIso = `${testYear}-06-15T10:00:00Z`;

  const paymentActorContext = {
    profile: {
      id: adminUser.id,
      isAdmin: true,
      permissions: ['payments:collect', 'payments:reverse', 'partners:read', 'partners:manage'],
    },
    user: adminUser,
  };

  await executeRecordPayment({
    loanId: testLoan.id,
    amountRupees: 500, // ₹500 total
    mode: 'CASH',
    collectedAt: paymentDateIso,
    collectorId: adminUser.id,
    idempotencyKey: `idemp-profit-${timestamp}`,
  }, paymentActorContext);

  // Calculate profit period covering this exact isolated payment window
  const periodCode = `PRF-TEST3-${timestamp}`;

  const period = await executeCalculateProfitPeriod({
    periodCode,
    name: `Principal Exclusion Period ${timestamp}`,
    startDate: start,
    endDate: end,
  }, actorContext);

  // Assertions:
  // Operating revenue should be ₹100 (10,000 paise finance charge), NOT ₹500!
  // Principal recovered should be ₹400 (40,000 paise principal), which is EXCLUDED from profit.
  assert.strictEqual(
    period.totalFinanceChargeCollectedPaise,
    10000,
    'Operating revenue must strictly equal collected finance charge (₹100)'
  );
  assert.strictEqual(
    period.totalPrincipalRecoveredPaise,
    40000,
    'Principal recovery must be recorded separately (₹400)'
  );
  assert.strictEqual(
    period.netProfitPaise,
    10000,
    'Net profit must equal collected finance charges minus expenses (₹100), EXCLUDING principal'
  );

  console.log('✓ Principal excluded from profit passed: ₹500 payment yielded ₹100 operating revenue; ₹400 principal recovery excluded from profit.');
}

async function test4_NoDistributionWithoutApprovedPeriod() {
  console.log('\n--- Test 4: Distribution Blocked Without Approved Profit Period ---');
  const actorContext = { id: adminUser.id, isAdmin: true };

  const start = new Date('2026-03-01T00:00:00Z');
  const end = new Date('2026-03-31T23:59:59Z');
  const periodCode = `PRF-UNAPPROVED-${timestamp}`;

  // Period is in CALCULATED status (not APPROVED)
  const unapprovedPeriod = await prisma.profitPeriod.create({
    data: {
      periodCode,
      name: `Unapproved Period ${timestamp}`,
      startDate: start,
      endDate: end,
      status: 'CALCULATED',
      totalFinanceChargeCollectedPaise: 50000,
      netProfitPaise: 50000,
      distributableProfitPaise: 50000,
    },
  });

  // Attempt distribution: MUST fail with rule violation
  await assert.rejects(
    async () => {
      await executePostProfitDistribution({
        profitPeriodId: unapprovedPeriod.id,
      }, actorContext);
    },
    (err) => {
      assert.match(err.message, /No distribution can be posted without a defined approved profit period/i);
      return true;
    },
    'Should reject posting distribution on unapproved profit period'
  );

  // Now, formally approve the period
  await executeApproveProfitPeriod(unapprovedPeriod.id, actorContext);

  const approvedPeriod = await prisma.profitPeriod.findUnique({ where: { id: unapprovedPeriod.id } });
  assert.strictEqual(approvedPeriod.status, 'APPROVED', 'Period must now be APPROVED');

  // Distribution should now succeed cleanly
  const dist = await executePostProfitDistribution({
    profitPeriodId: unapprovedPeriod.id,
  }, actorContext);

  assert.strictEqual(dist.status, 'POSTED');
  console.log('✓ Distribution policy enforced: Posting blocked on unapproved period; succeeded after formal admin approval.');
}

async function test5_PartnerWithdrawalReducesCapitalOnlyWhenPaid() {
  console.log('\n--- Test 5: Partner Withdrawal Redirection & Strict Payout Timing ---');
  const actorContext = { id: adminUser.id, isAdmin: true };

  const startingBalance = await derivePartnerCapitalBalance(testPartner1.id);
  const withdrawAmountPaise = 100000; // ₹1,000

  // 1. Request withdrawal -> PENDING
  const withdrawal = await executeRequestPartnerWithdrawal({
    partnerId: testPartner1.id,
    amountPaise: withdrawAmountPaise,
    withdrawalType: 'CAPITAL_WITHDRAWAL',
    notes: 'Personal capital withdrawal',
  }, actorContext);

  assert.strictEqual(withdrawal.status, 'PENDING');
  let currentBalance = await derivePartnerCapitalBalance(testPartner1.id);
  assert.strictEqual(currentBalance, startingBalance, 'Pending withdrawal MUST NOT reduce capital balance');

  // 2. Approve withdrawal -> APPROVED
  await executeApprovePartnerWithdrawal({
    withdrawalId: withdrawal.id,
    notes: 'Approved by Managing Partner',
  }, actorContext);

  const approvedWithdrawal = await prisma.partnerWithdrawal.findUnique({ where: { id: withdrawal.id } });
  assert.strictEqual(approvedWithdrawal.status, 'APPROVED');

  currentBalance = await derivePartnerCapitalBalance(testPartner1.id);
  assert.strictEqual(currentBalance, startingBalance, 'Approved but unpaid withdrawal MUST NOT reduce capital balance');

  // 3. Payout withdrawal -> PAID
  const { withdrawal: paidWithdrawal, capitalEntry } = await executePayoutPartnerWithdrawal({
    withdrawalId: withdrawal.id,
    paymentMode: 'BANK_TRANSFER',
    reference: 'IMPS-9921448',
  }, actorContext);

  assert.strictEqual(paidWithdrawal.status, 'PAID');
  assert.ok(capitalEntry, 'Compensating Capital Entry must be created upon payout');

  // Now the derived capital balance MUST be reduced by exactly ₹1,000
  const finalBalance = await derivePartnerCapitalBalance(testPartner1.id);
  assert.strictEqual(finalBalance, startingBalance - withdrawAmountPaise, 'Paid withdrawal MUST officially reduce capital');

  console.log('✓ Partner withdrawal timing passed: Capital remained untouched through PENDING and APPROVED states, reducing only upon PAID.');
}

async function test6_AuthoritativeDerivedCapitalBalance() {
  console.log('\n--- Test 6: Authoritative Derived Capital Balance (Zero Drift) ---');
  const actorContext = { id: adminUser.id, isAdmin: true };

  const partner = await executeCreatePartner({
    name: `Drift Test Partner ${timestamp}`,
    partnerCode: `PRT-D${String(timestamp).slice(-4)}`,
    capitalRatio: 10,
    profitRatio: 10,
    lossRatio: 10,
  }, actorContext);

  // Initial balance is 0
  let bal = await derivePartnerCapitalBalance(partner.id);
  assert.strictEqual(bal, 0);

  // 1st contribution: +₹10,000
  await executeRecordCapitalContribution({
    partnerId: partner.id,
    amountPaise: 1000000,
    entryType: 'INITIAL_CONTRIBUTION',
  }, actorContext);

  bal = await derivePartnerCapitalBalance(partner.id);
  assert.strictEqual(bal, 1000000);

  // 2nd contribution: +₹5,000
  await executeRecordCapitalContribution({
    partnerId: partner.id,
    amountPaise: 500000,
    entryType: 'ADDITIONAL_CONTRIBUTION',
  }, actorContext);

  bal = await derivePartnerCapitalBalance(partner.id);
  assert.strictEqual(bal, 1500000);

  // Withdrawal: -₹3,000
  const wth = await executeRequestPartnerWithdrawal({
    partnerId: partner.id,
    amountPaise: 300000,
  }, actorContext);
  await executeApprovePartnerWithdrawal({ withdrawalId: wth.id }, actorContext);
  await executePayoutPartnerWithdrawal({ withdrawalId: wth.id }, actorContext);

  bal = await derivePartnerCapitalBalance(partner.id);
  assert.strictEqual(bal, 1200000); // ₹12,000 exact

  console.log('✓ Authoritative derived capital passed: 10,000 + 5,000 - 3,000 = ₹12,000 exact derived balance with zero drift.');
}

async function runAllTests() {
  try {
    await setup();
    await test1_HistoricalDistributionImmutable();
    await test2_CapitalContributionAndCashBagSeparation();
    await test3_PrincipalRepaymentExcludedFromProfit();
    await test4_NoDistributionWithoutApprovedPeriod();
    await test5_PartnerWithdrawalReducesCapitalOnlyWhenPaid();
    await test6_AuthoritativeDerivedCapitalBalance();

    console.log('\n======================================================');
    console.log('✅ ALL MODULE 07 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Module 07 Test Failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

runAllTests();
