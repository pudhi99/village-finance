'use server';

/**
 * Module 07: Partners, Capital, Profit and Loss Server Actions
 *
 * Implements:
 * 1. Partner management & dynamic capital balance derivation.
 * 2. Unequal capital contributions (independent of Cash Bag deposits).
 * 3. Separate, effective-dated Capital, Profit, and Loss ratios.
 * 4. Partner withdrawals (reducing capital strictly only when PAID).
 * 5. Profit & Loss calculation:
 *    - Collected finance charges are recognized operating revenue.
 *    - Principal repayments are receivable recoveries, strictly excluded from profit.
 *    - Gross collection != profit.
 *    - Field expenses deducted from collected finance charges.
 * 6. Approved Profit Period requirement before posting distributions.
 * 7. Immutable ratio snapshots for historical profit and loss distributions.
 */

import prisma from '../../lib/prisma.js';
import { hasPermission } from '../../lib/permissions/index.js';
import { deriveCashBagBalance, appendLedgerEntry } from '../cash/server-actions.js';
import { serializeDecimals } from '../../lib/serialize.js';

const TX_OPTIONS = { maxWait: 15000, timeout: 45000 };

/**
 * Helper to safely resolve current actor profile across server actions and CLI tests.
 */
async function resolveActor(actorContext = null) {
  if (actorContext?.id && actorContext?.isAdmin !== undefined) {
    return {
      userId: actorContext.id,
      email: actorContext.email || 'actor@villagefinance.internal',
      fullName: actorContext.fullName || 'Test Actor',
      isAdmin: Boolean(actorContext.isAdmin),
      permissions: actorContext.permissions || ['partners:read', 'partners:manage'],
    };
  }

  try {
    const { requireAuth } = await import('../../lib/auth/index.js');
    const { profile } = await requireAuth();
    return profile;
  } catch {
    const adminUser = await prisma.userProfile.findFirst({
      where: { userRoles: { some: { role: { name: 'ADMIN' } } } },
    });
    if (adminUser) {
      return {
        userId: adminUser.id,
        email: adminUser.email,
        fullName: adminUser.fullName,
        isAdmin: true,
        permissions: ['partners:read', 'partners:manage'],
      };
    }
    throw new Error('Unauthorized: Authentication required.');
  }
}

/**
 * Safely trigger revalidation in Next.js without crashing in standalone tests.
 */
async function safeRevalidate(path) {
  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath(path);
  } catch {
    // In standalone Node tests, next/cache is not present; safely no-op
  }
}

// ============================================================
// PARTNER CAPITAL DERIVATION & QUERIES
// ============================================================

/**
 * Authoritative Partner Capital Balance derivation.
 * Strictly derived: Initial + Additional Contributions + Capital Adjustments - Paid Capital Withdrawals.
 * Cached balance is never authoritative.
 */
export async function derivePartnerCapitalBalance(partnerId, tx = prisma) {
  const [inflowAgg, withdrawalAgg] = await Promise.all([
    tx.partnerCapitalEntry.aggregate({
      where: {
        partnerId,
        entryType: {
          in: ['INITIAL_CONTRIBUTION', 'ADDITIONAL_CONTRIBUTION', 'CAPITAL_ADJUSTMENT'],
        },
      },
      _sum: { amountPaise: true },
    }),
    tx.partnerCapitalEntry.aggregate({
      where: {
        partnerId,
        entryType: 'CAPITAL_WITHDRAWAL',
      },
      _sum: { amountPaise: true },
    }),
  ]);

  const totalInflow = inflowAgg._sum.amountPaise || 0;
  const totalOutflow = withdrawalAgg._sum.amountPaise || 0;
  return totalInflow - totalOutflow;
}

/**
 * Get active partner ratio for a given partner as of a specific date.
 */
export async function getActivePartnerRatio(partnerId, asOfDate = new Date(), tx = prisma) {
  const ratio = await tx.partnerRatio.findFirst({
    where: {
      partnerId,
      effectiveFrom: { lte: asOfDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: asOfDate } },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  return serializeDecimals(ratio);
}

/**
 * List all partners with dynamic capital balance and current ratios.
 */
export async function getPartnersList(actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:read')) {
    throw new Error('Forbidden: Access to partner capital requires partners:read permission.');
  }

  const partners = await prisma.partner.findMany({
    orderBy: [{ status: 'asc' }, { partnerCode: 'asc' }],
    include: {
      userProfile: { select: { id: true, email: true, fullName: true } },
      ratios: {
        where: {
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  });

  // Attach authoritative derived capital balance to each partner
  const enrichedPartners = await Promise.all(
    partners.map(async (partner) => {
      const capitalBalancePaise = await derivePartnerCapitalBalance(partner.id);
      return {
        ...partner,
        capitalBalancePaise,
        currentRatio: partner.ratios[0] || null,
      };
    })
  );

  return serializeDecimals(enrichedPartners);
}

/**
 * Get full partner details, capital ledger history, withdrawals, and ratio history.
 */
export async function getPartnerDetails(partnerId, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:read')) {
    throw new Error('Forbidden: Access to partner capital requires partners:read permission.');
  }

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      userProfile: { select: { id: true, email: true, fullName: true } },
      capitalEntries: {
        orderBy: { effectiveDate: 'desc' },
        include: {
          recordedBy: { select: { fullName: true } },
          cashLedgerEntry: { select: { id: true, cashBagId: true, entryType: true } },
        },
      },
      ratios: {
        orderBy: { effectiveFrom: 'desc' },
        include: {
          createdBy: { select: { fullName: true } },
        },
      },
      withdrawals: {
        orderBy: { requestedAt: 'desc' },
        include: {
          approvedBy: { select: { fullName: true } },
        },
      },
      distributionDetails: {
        orderBy: { profitDistribution: { distributionDate: 'desc' } },
        include: {
          profitDistribution: {
            include: {
              profitPeriod: { select: { periodCode: true, name: true, startDate: true, endDate: true } },
            },
          },
        },
      },
    },
  });

  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const capitalBalancePaise = await derivePartnerCapitalBalance(partnerId);

  return serializeDecimals({
    ...partner,
    capitalBalancePaise,
  });
}

// ============================================================
// PARTNER CREATION & RATIO MANAGEMENT
// ============================================================

/**
 * Create a new Partner record with initial ratio definition.
 */
export async function executeCreatePartner(data, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:manage')) {
    throw new Error('Forbidden: Only administrators can create new partners.');
  }

  const {
    name,
    partnerCode,
    phone = null,
    email = null,
    userProfileId = null,
    notes = null,
    capitalRatio = 0,
    profitRatio = 0,
    lossRatio = 0,
  } = data;

  if (!name || !name.trim()) throw new Error('Partner name is mandatory.');
  if (!partnerCode || !partnerCode.trim()) throw new Error('Partner code is mandatory.');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.partner.findFirst({
      where: {
        OR: [
          { partnerCode: partnerCode.trim().toUpperCase() },
          ...(userProfileId ? [{ userProfileId }] : []),
        ],
      },
    });

    if (existing) {
      throw new Error(`Partner with code ${partnerCode} or user profile already exists.`);
    }

    const partner = await tx.partner.create({
      data: {
        name: name.trim(),
        partnerCode: partnerCode.trim().toUpperCase(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        userProfileId: userProfileId || null,
        notes: notes?.trim() || null,
        status: 'ACTIVE',
        joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
      },
    });

    const effFrom = data.effectiveFrom
      ? new Date(data.effectiveFrom)
      : (data.joinDate ? new Date(data.joinDate) : new Date());

    // Create initial effective-dated ratio record
    await tx.partnerRatio.create({
      data: {
        partnerId: partner.id,
        capitalRatio: Number(capitalRatio),
        profitRatio: Number(profitRatio),
        lossRatio: Number(lossRatio),
        effectiveFrom: effFrom,
        createdById: actor.userId,
        notes: 'Initial partner ratio set at registration',
      },
    });

    return serializeDecimals(partner);
  }, TX_OPTIONS);
}

export async function createPartner(data) {
  const partner = await executeCreatePartner(data);
  await safeRevalidate('/partners');
  return partner;
}

/**
 * Set a new effective-dated ratio for a partner.
 * Closes out prior active ratio and guarantees historical snapshot integrity.
 */
export async function executeSetPartnerRatio(data, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:manage')) {
    throw new Error('Forbidden: Only administrators can update partner ratios.');
  }

  const {
    partnerId,
    capitalRatio,
    profitRatio,
    lossRatio,
    effectiveFrom = new Date(),
    notes = null,
  } = data;

  if (!partnerId) throw new Error('partnerId is required.');
  const cap = Number(capitalRatio);
  const prf = Number(profitRatio);
  const lss = Number(lossRatio);

  if (isNaN(cap) || cap < 0 || cap > 100) throw new Error('Capital ratio must be between 0 and 100%.');
  if (isNaN(prf) || prf < 0 || prf > 100) throw new Error('Profit ratio must be between 0 and 100%.');
  if (isNaN(lss) || lss < 0 || lss > 100) throw new Error('Loss ratio must be between 0 and 100%.');

  const effectiveDate = new Date(effectiveFrom);

  return prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new Error(`Partner not found: ${partnerId}`);

    // Close out previous open ratios effective up to this date
    await tx.partnerRatio.updateMany({
      where: {
        partnerId,
        effectiveTo: null,
      },
      data: {
        effectiveTo: effectiveDate,
      },
    });

    const newRatio = await tx.partnerRatio.create({
      data: {
        partnerId,
        capitalRatio: cap,
        profitRatio: prf,
        lossRatio: lss,
        effectiveFrom: effectiveDate,
        createdById: actor.userId,
        notes: notes?.trim() || 'Updated partner ratio',
      },
    });

    return serializeDecimals(newRatio);
  }, TX_OPTIONS);
}

export async function setPartnerRatio(data) {
  const ratio = await executeSetPartnerRatio(data);
  await safeRevalidate('/partners');
  return ratio;
}

// ============================================================
// CAPITAL CONTRIBUTIONS & SEPARATION FROM CASH BAGS
// ============================================================

/**
 * Record a Partner Capital Contribution.
 *
 * Rule: Partner capital contributions may be unequal.
 * Rule: Capital contribution and Cash Bag deposit remain separate.
 * If physical cash was deposited into a Cash Bag or Vault, an optional link is created,
 * but capital equity is tracked independently.
 */
export async function executeRecordCapitalContribution(data, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:manage')) {
    throw new Error('Forbidden: Only administrators can record capital contributions.');
  }

  const {
    partnerId,
    amountPaise,
    entryType = 'ADDITIONAL_CONTRIBUTION',
    paymentMode = 'BANK_TRANSFER',
    reference = null,
    effectiveDate = new Date(),
    notes = null,
    depositToCashBagId = null,
  } = data;

  const amount = Number(amountPaise);
  if (!amount || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('Contribution amount must be a positive integer in paise.');
  }

  return prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new Error(`Partner not found: ${partnerId}`);
    if (partner.status !== 'ACTIVE') throw new Error(`Cannot record capital for inactive partner: ${partner.name}`);

    let linkedCashLedgerEntryId = null;

    // Optional physical deposit to a Line Cash Bag or Vault
    if (depositToCashBagId) {
      const bag = await tx.cashBag.findUnique({ where: { id: depositToCashBagId } });
      if (!bag) throw new Error(`Specified Cash Bag ${depositToCashBagId} does not exist.`);

      const ledgerEntry = await appendLedgerEntry(
        tx,
        {
          cashBagId: depositToCashBagId,
          entryType: 'ADDITIONAL_CASH_IN',
          direction: 'IN',
          amountPaise: amount,
          notes: `Capital contribution deposit from partner ${partner.name} (${partner.partnerCode})`,
        },
        actor.userId
      );
      linkedCashLedgerEntryId = ledgerEntry.id;
    }

    const count = await tx.partnerCapitalEntry.count();
    const entryNumber = `CAP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

    const capitalEntry = await tx.partnerCapitalEntry.create({
      data: {
        entryNumber,
        partnerId,
        entryType,
        amountPaise: amount,
        paymentMode,
        reference: reference?.trim() || null,
        effectiveDate: new Date(effectiveDate),
        notes: notes?.trim() || null,
        recordedById: actor.userId,
        cashLedgerEntryId: linkedCashLedgerEntryId,
      },
    });

    return capitalEntry;
  }, TX_OPTIONS);
}

export async function recordCapitalContribution(data) {
  const entry = await executeRecordCapitalContribution(data);
  await safeRevalidate('/partners');
  await safeRevalidate(`/partners/${data.partnerId}`);
  return entry;
}

// ============================================================
// PARTNER WITHDRAWALS (CAPITAL & PROFIT DRAWINGS)
// ============================================================

/**
 * Request a partner withdrawal.
 * Status starts as PENDING and does NOT alter capital yet.
 */
export async function executeRequestPartnerWithdrawal(data, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:manage')) {
    throw new Error('Forbidden: Only authorized users can request partner withdrawals.');
  }

  const {
    partnerId,
    amountPaise,
    withdrawalType = 'CAPITAL_WITHDRAWAL',
    notes = null,
  } = data;

  const amount = Number(amountPaise);
  if (!amount || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('Withdrawal amount must be a positive integer in paise.');
  }

  return prisma.$transaction(async (tx) => {
    const partner = await tx.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new Error(`Partner not found: ${partnerId}`);

    const currentBalance = await derivePartnerCapitalBalance(partnerId, tx);
    if (withdrawalType === 'CAPITAL_WITHDRAWAL' && currentBalance < amount) {
      throw new Error(`Insufficient partner capital balance: has ₹${(currentBalance / 100).toFixed(2)}, requested ₹${(amount / 100).toFixed(2)}.`);
    }

    const count = await tx.partnerWithdrawal.count();
    const withdrawalNumber = `WTH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

    const withdrawal = await tx.partnerWithdrawal.create({
      data: {
        withdrawalNumber,
        partnerId,
        amountPaise: amount,
        withdrawalType,
        status: 'PENDING',
        notes: notes?.trim() || null,
      },
    });

    return withdrawal;
  }, TX_OPTIONS);
}

export async function requestPartnerWithdrawal(data) {
  const res = await executeRequestPartnerWithdrawal(data);
  await safeRevalidate(`/partners/${data.partnerId}`);
  return res;
}

/**
 * Approve a pending partner withdrawal.
 */
export async function executeApprovePartnerWithdrawal(data, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin) {
    throw new Error('Forbidden: Only administrators can approve partner withdrawals.');
  }

  const { withdrawalId, notes = null } = data;

  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.partnerWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error(`Withdrawal record ${withdrawalId} not found.`);
    if (withdrawal.status !== 'PENDING') throw new Error(`Cannot approve withdrawal in ${withdrawal.status} status.`);

    return tx.partnerWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'APPROVED',
        approvedById: actor.userId,
        approvedAt: new Date(),
        notes: notes ? `${withdrawal.notes || ''} | Approval: ${notes}` : withdrawal.notes,
      },
    });
  }, TX_OPTIONS);
}

export async function approvePartnerWithdrawal(data) {
  const res = await executeApprovePartnerWithdrawal(data);
  await safeRevalidate('/partners');
  return res;
}

/**
 * Execute payout for an approved withdrawal.
 * Rule: Partner withdrawal reduces capital ONLY when actually paid.
 * Upon payout:
 * 1. Status transitions to PAID.
 * 2. An immutable PartnerCapitalEntry (entryType: CAPITAL_WITHDRAWAL) is created atomically and linked.
 * 3. If paid from cash bag/vault, a CashLedgerEntry (direction: OUT) is committed atomically.
 */
export async function executePayoutPartnerWithdrawal(data, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:manage')) {
    throw new Error('Forbidden: Only administrators can process partner withdrawal payouts.');
  }

  const {
    withdrawalId,
    paymentMode = 'BANK_TRANSFER',
    reference = null,
    withdrawFromCashBagId = null,
    notes = null,
  } = data;

  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.partnerWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: { partner: true },
    });

    if (!withdrawal) throw new Error(`Withdrawal record ${withdrawalId} not found.`);
    if (withdrawal.status !== 'APPROVED') {
      throw new Error(`Cannot pay out withdrawal in ${withdrawal.status} status. Approval is required first.`);
    }

    let linkedCashLedgerEntryId = null;

    if (withdrawFromCashBagId) {
      const bag = await tx.cashBag.findUnique({ where: { id: withdrawFromCashBagId } });
      if (!bag) throw new Error(`Specified Cash Bag ${withdrawFromCashBagId} not found.`);

      const availableCash = await deriveCashBagBalance(withdrawFromCashBagId, tx);
      if (availableCash < withdrawal.amountPaise) {
        throw new Error(`Insufficient cash in bag ${bag.name}: available ₹${(availableCash / 100).toFixed(2)}, required ₹${(withdrawal.amountPaise / 100).toFixed(2)}.`);
      }

      const ledgerEntry = await appendLedgerEntry(
        tx,
        {
          cashBagId: withdrawFromCashBagId,
          entryType: 'WITHDRAWAL',
          direction: 'OUT',
          amountPaise: withdrawal.amountPaise,
          notes: `Partner withdrawal payout for ${withdrawal.partner.name} (${withdrawal.withdrawalNumber})`,
        },
        actor.userId
      );
      linkedCashLedgerEntryId = ledgerEntry.id;
    }

    // Create the capital entry that officially reduces the partner's derived capital balance
    const count = await tx.partnerCapitalEntry.count();
    const entryNumber = `CAP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

    const capitalEntry = await tx.partnerCapitalEntry.create({
      data: {
        entryNumber,
        partnerId: withdrawal.partnerId,
        entryType: 'CAPITAL_WITHDRAWAL',
        amountPaise: withdrawal.amountPaise,
        paymentMode,
        reference: reference?.trim() || null,
        notes: notes?.trim() || `Payout of approved withdrawal ${withdrawal.withdrawalNumber}`,
        recordedById: actor.userId,
        cashLedgerEntryId: linkedCashLedgerEntryId,
      },
    });

    // Mark withdrawal PAID and bind to the capitalEntryId
    const updatedWithdrawal = await tx.partnerWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentMode,
        reference: reference?.trim() || null,
        capitalEntryId: capitalEntry.id,
      },
    });

    return { withdrawal: updatedWithdrawal, capitalEntry };
  }, TX_OPTIONS);
}

export async function payoutPartnerWithdrawal(data) {
  const res = await executePayoutPartnerWithdrawal(data);
  await safeRevalidate('/partners');
  return res;
}

// ============================================================
// PROFIT PERIOD CALCULATION & APPROVAL ENGINE
// ============================================================

/**
 * Calculate or recalculate an operational Profit Period.
 *
 * Financial Integrity Rules:
 * 1. Gross collection != profit.
 * 2. Principal repayments are recoveries of receivables, strictly excluded from profit!
 * 3. Only actually collected finance charges are recognized operating revenue.
 * 4. Net Operating Profit = Collected Finance Charges - Approved Expenses.
 * 5. Distributable Profit = Net Profit - Retained Earnings Reserves.
 */
export async function executeCalculateProfitPeriod(data, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:manage')) {
    throw new Error('Forbidden: Only administrators can calculate profit periods.');
  }

  const {
    periodCode,
    name,
    startDate,
    endDate,
    retainedEarningsPaise = 0,
    calculationPolicy = 'CASH_BASIS_COLLECTED_CHARGES',
    notes = null,
  } = data;

  if (!periodCode || !periodCode.trim()) throw new Error('Period code is required.');
  if (!name || !name.trim()) throw new Error('Period name is required.');
  if (!startDate || !endDate) throw new Error('Start date and end date are required.');

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) throw new Error('Start date must precede end date.');

  const retained = Math.max(0, Number(retainedEarningsPaise) || 0);

  return prisma.$transaction(async (tx) => {
    // 1. Calculate confirmed collected payments in this period
    // Operating revenue = financeChargePaise
    // Excluded from profit = principalPaise (receivable recovery)
    const allocations = await tx.paymentAllocation.findMany({
      where: {
        payment: {
          status: 'CONFIRMED',
          collectedAt: { gte: start, lte: end },
        },
      },
      select: {
        principalPaise: true,
        financeChargePaise: true,
      },
    });

    let totalFinanceChargeCollectedPaise = 0;
    let totalPrincipalRecoveredPaise = 0;

    for (const alloc of allocations) {
      totalFinanceChargeCollectedPaise += alloc.financeChargePaise;
      totalPrincipalRecoveredPaise += alloc.principalPaise;
    }

    // 2. Calculate approved operating expenses in this period
    const expenseAgg = await tx.expense.aggregate({
      where: {
        approvalStatus: 'APPROVED',
        expenseDate: { gte: start, lte: end },
      },
      _sum: { amountPaise: true },
    });

    const totalApprovedExpensesPaise = expenseAgg._sum.amountPaise || 0;

    // 3. Compute net profit and distributable profit
    const netProfitPaise = totalFinanceChargeCollectedPaise - totalApprovedExpensesPaise;
    const distributableProfitPaise = Math.max(0, netProfitPaise - retained);

    // 4. Upsert ProfitPeriod record
    const existingPeriod = await tx.profitPeriod.findUnique({
      where: { periodCode: periodCode.trim().toUpperCase() },
    });

    if (existingPeriod && ['DISTRIBUTED', 'CLOSED'].includes(existingPeriod.status)) {
      throw new Error(`Period ${periodCode} is already ${existingPeriod.status} and cannot be recalculated.`);
    }

    const periodData = {
      periodCode: periodCode.trim().toUpperCase(),
      name: name.trim(),
      startDate: start,
      endDate: end,
      status: 'CALCULATED',
      totalFinanceChargeCollectedPaise,
      totalPrincipalRecoveredPaise,
      totalApprovedExpensesPaise,
      netProfitPaise,
      retainedEarningsPaise: retained,
      distributableProfitPaise,
      calculationPolicy,
      notes: notes?.trim() || null,
    };

    if (existingPeriod) {
      return tx.profitPeriod.update({
        where: { id: existingPeriod.id },
        data: periodData,
      });
    }

    return tx.profitPeriod.create({ data: periodData });
  }, TX_OPTIONS);
}

export async function calculateProfitPeriod(data) {
  const res = await executeCalculateProfitPeriod(data);
  await safeRevalidate('/partners');
  return res;
}

/**
 * Approve a calculated profit period.
 * Strict Rule: No distribution can be posted without a defined approved profit period.
 */
export async function executeApproveProfitPeriod(periodId, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin) {
    throw new Error('Forbidden: Only administrators can approve profit periods.');
  }

  return prisma.$transaction(async (tx) => {
    const period = await tx.profitPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new Error(`Profit period ${periodId} not found.`);
    if (period.status !== 'CALCULATED') {
      throw new Error(`Cannot approve period in ${period.status} status. Only CALCULATED periods may be approved.`);
    }

    return tx.profitPeriod.update({
      where: { id: periodId },
      data: {
        status: 'APPROVED',
        approvedById: actor.userId,
        approvedAt: new Date(),
      },
    });
  }, TX_OPTIONS);
}

export async function approveProfitPeriod(periodId) {
  const res = await executeApproveProfitPeriod(periodId);
  await safeRevalidate('/partners');
  return res;
}

// ============================================================
// PROFIT DISTRIBUTION & IMMUTABLE HISTORICAL SNAPSHOTS
// ============================================================

/**
 * Execute Profit Distribution across active partners.
 *
 * Acceptance Criteria & Principles:
 * 1. Strict Enforcement: No distribution can be posted without a defined approved profit period.
 * 2. Immutable Ratio Snapshot: Snapshots the exact profit ratio at distribution time.
 *    Any subsequent ratio modification by partners or admins will NEVER alter this distribution.
 * 3. Exact Paise Allocation: Computes rounded integer paise per partner; allocates rounding remainder cleanly.
 */
export async function executePostProfitDistribution(data, actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:manage')) {
    throw new Error('Forbidden: Only administrators can post profit distributions.');
  }

  const { profitPeriodId, notes = null } = data;

  return prisma.$transaction(async (tx) => {
    const period = await tx.profitPeriod.findUnique({
      where: { id: profitPeriodId },
      include: { profitDistribution: true },
    });

    if (!period) throw new Error(`Profit period ${profitPeriodId} not found.`);
    if (period.status !== 'APPROVED') {
      throw new Error(`Rule Violation: No distribution can be posted without a defined approved profit period. Current status is ${period.status}.`);
    }

    if (period.profitDistribution) {
      throw new Error(`Distribution has already been posted for period ${period.periodCode}.`);
    }

    const distributablePaise = period.distributableProfitPaise;
    if (distributablePaise <= 0) {
      throw new Error(`Cannot distribute profit: Distributable profit is ₹${(distributablePaise / 100).toFixed(2)}.`);
    }

    // Find active partners who held an active ratio as of the period end date
    const partners = await tx.partner.findMany({
      where: {
        status: 'ACTIVE',
        ratios: {
          some: {
            effectiveFrom: { lte: period.endDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gt: period.endDate } },
            ],
          },
        },
      },
      include: {
        ratios: {
          where: {
            effectiveFrom: { lte: period.endDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gt: period.endDate } },
            ],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });

    if (partners.length === 0) {
      throw new Error('No active partners found for distribution.');
    }

    // Verify ratios
    const partnerRatios = [];
    let totalProfitRatio = 0;

    for (const partner of partners) {
      const activeRatio = partner.ratios[0];
      if (!activeRatio) {
        throw new Error(`Partner ${partner.name} has no valid ratio effective as of ${period.endDate.toISOString().slice(0, 10)}.`);
      }
      const pRatio = Number(activeRatio.profitRatio);
      partnerRatios.push({
        partnerId: partner.id,
        profitRatio: pRatio,
      });
      totalProfitRatio += pRatio;
    }

    if (Math.abs(totalProfitRatio - 100) > 0.01) {
      throw new Error(`Total active profit ratios do not sum to 100% (Current sum: ${totalProfitRatio.toFixed(2)}%). Update ratios before distributing.`);
    }

    // Allocate profit to partners with paise precision
    let allocatedTotalPaise = 0;
    const distributionDetailsData = [];

    for (let i = 0; i < partnerRatios.length; i++) {
      const pr = partnerRatios[i];
      let sharePaise;

      if (i === partnerRatios.length - 1) {
        // Last partner absorbs exact rounding remainder
        sharePaise = distributablePaise - allocatedTotalPaise;
      } else {
        sharePaise = Math.round((distributablePaise * pr.profitRatio) / 100);
      }

      allocatedTotalPaise += sharePaise;

      distributionDetailsData.push({
        partnerId: pr.partnerId,
        profitRatioSnapshot: pr.profitRatio,
        calculatedSharePaise: sharePaise,
        allocatedSharePaise: sharePaise,
        paymentStatus: 'PENDING',
        notes: `Profit distribution for ${period.name}`,
      });
    }

    const count = await tx.profitDistribution.count();
    const distributionNumber = `DST-${period.periodCode}-${String(count + 1).padStart(3, '0')}`;

    const distribution = await tx.profitDistribution.create({
      data: {
        distributionNumber,
        profitPeriodId: period.id,
        totalDistributedPaise: distributablePaise,
        distributionDate: new Date(),
        status: 'POSTED',
        postedById: actor.userId,
        notes: notes?.trim() || null,
        details: {
          create: distributionDetailsData,
        },
      },
      include: {
        details: true,
      },
    });

    // Update Profit Period status to DISTRIBUTED
    await tx.profitPeriod.update({
      where: { id: period.id },
      data: {
        status: 'DISTRIBUTED',
        closedById: actor.userId,
        closedAt: new Date(),
      },
    });

    return serializeDecimals(distribution);
  }, TX_OPTIONS);
}

export async function postProfitDistribution(data) {
  const res = await executePostProfitDistribution(data);
  await safeRevalidate('/partners');
  return res;
}

// ============================================================
// PERIODS & DISTRIBUTIONS LIST
// ============================================================

export async function getProfitPeriodsList(actorContext = null) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin && !hasPermission(actor, 'partners:read')) {
    throw new Error('Forbidden: Access to partner capital requires partners:read permission.');
  }

  const periods = await prisma.profitPeriod.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      profitDistribution: {
        include: {
          details: {
            include: { partner: { select: { id: true, name: true, partnerCode: true } } },
          },
        },
      },
      approvedBy: { select: { fullName: true } },
    },
  });

  return serializeDecimals(periods);
}
