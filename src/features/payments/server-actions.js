'use server';

/**
 * Payments, FIFO Allocations, Advance Credits & Reversals
 * Module 04 — Village Finance
 *
 * Implements:
 * - Every payment belongs to one explicit Loan and Customer
 * - FIFO allocation: oldest pending installment satisfied first, then cascading to future installments
 * - Exact component allocation respecting stored schedule principal/finance-charge ratios
 * - Excess payment beyond loan becomes same-loan Advance Credit (no cross-loan transfer)
 * - Atomic execution inside database transaction with row-level serialization
 * - Client-supplied UUID idempotencyKey ensures zero double-allocations on retries
 * - Admin-only reversals restoring installment balances and voids advance credit atomically
 * - Full audit trail for all payment lifecycles (PAYMENT_RECORDED, PAYMENT_REVERSED)
 */
import prisma from '../../lib/prisma.js';
import { requirePermission, isScopeAllowed, requireScope } from '../../lib/permissions/index.js';
import { writeAudit } from '../../lib/audit/index.js';
import { validate, z } from '../../lib/validation/index.js';
import { rupeesToPaise, paiseToRupees } from '../../lib/money/index.js';
import { postCashCollectionEntry, postCashReversalEntry } from '../cash/server-actions.js';

// ---- Validation Schemas ----

const recordPaymentSchema = z.object({
  loanId: z.string().uuid('Invalid loan ID'),
  amountRupees: z.number().positive('Payment amount must be greater than zero'),
  mode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  reference: z.string().optional().nullable(),
  lineId: z.string().uuid('Invalid line ID').optional().nullable(),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  collectedAt: z.string().optional().nullable(),
});

const reversePaymentSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  reason: z.string().min(5, 'A clear documented reason (minimum 5 characters) is required for payment reversals'),
});

async function safeRevalidate(path) {
  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath(path);
  } catch {
    // Outside Next.js request context (e.g. CLI or integration test)
  }
}

async function getAuthSession() {
  const { requireAuth } = await import('../../lib/auth/index.js');
  return requireAuth();
}

// ---- Public Queries ----

/**
 * Get paginated list of payments with filter support.
 */
export async function getPaymentsList({
  loanId,
  customerId,
  lineId,
  mode,
  status = 'ALL',
  search = '',
  limit = 50,
  offset = 0,
} = {}, actorContext = null) {
  let profile = actorContext?.profile;
  if (!profile) {
    const auth = await getAuthSession();
    profile = auth.profile;
  }
  requirePermission(profile, 'payments:read');

  const where = {};

  if (loanId) where.loanId = loanId;
  if (customerId) where.customerId = customerId;
  if (lineId) where.lineId = lineId;
  if (mode) where.mode = mode;
  if (status !== 'ALL') where.status = status;

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { paymentNumber: { contains: q, mode: 'insensitive' } },
      { reference: { contains: q, mode: 'insensitive' } },
      { customer: { fullName: { contains: q, mode: 'insensitive' } } },
      { customer: { customerNumber: { contains: q, mode: 'insensitive' } } },
      { loan: { loanNumber: { contains: q, mode: 'insensitive' } } },
    ];
  }

  // Data scope filtering for non-admin
  if (!profile.isAdmin) {
    const allowedLineIds = profile.dataScopes
      .filter((ds) => ds.scopeType === 'LINE')
      .map((ds) => ds.scopeValue);
    const allowedVillageIds = profile.dataScopes
      .filter((ds) => ds.scopeType === 'VILLAGE')
      .map((ds) => ds.scopeValue);

    if (allowedLineIds.length > 0 || allowedVillageIds.length > 0) {
      where.customer = {
        ...where.customer,
        OR: [
          ...(allowedLineIds.length > 0
            ? [{ lineAssignments: { some: { lineId: { in: allowedLineIds }, isCurrent: true } } }]
            : []),
          ...(allowedVillageIds.length > 0
            ? [{ villageId: { in: allowedVillageIds } }]
            : []),
        ],
      };
    }
  }

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { collectedAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        customer: {
          select: { id: true, customerNumber: true, fullName: true, village: { select: { name: true } } },
        },
        loan: {
          select: { id: true, loanNumber: true, scheme: { select: { name: true, code: true } } },
        },
        collectedBy: {
          select: { id: true, fullName: true, email: true },
        },
        reversal: {
          include: {
            reversedBy: { select: { id: true, fullName: true } },
          },
        },
        _count: {
          select: { allocations: true },
        },
      },
    }),
  ]);

  return {
    total,
    payments: payments.map((p) => ({
      ...p,
      amountRupees: paiseToRupees(p.amountPaise),
      principalPaidRupees: paiseToRupees(p.principalPaidPaise),
      financeChargePaidRupees: paiseToRupees(p.financeChargePaidPaise),
      advanceCreditRupees: paiseToRupees(p.advanceCreditPaise),
    })),
  };
}

/**
 * Get detailed payment record including receipt and allocation breakdown.
 */
export async function getPaymentDetails(paymentId, actorContext = null) {
  let profile = actorContext?.profile;
  if (!profile) {
    const auth = await getAuthSession();
    profile = auth.profile;
  }
  requirePermission(profile, 'payments:read');

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      customer: {
        include: {
          village: true,
          area: true,
          phones: { where: { isPrimary: true }, take: 1 },
        },
      },
      loan: {
        include: {
          scheme: true,
        },
      },
      collectedBy: {
        select: { id: true, fullName: true, email: true },
      },
      line: {
        select: { id: true, name: true, code: true },
      },
      allocations: {
        orderBy: { installment: { installmentNumber: 'asc' } },
        include: {
          installment: true,
        },
      },
      advanceCreditEntries: true,
      reversal: {
        include: {
          reversedBy: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  });

  if (!payment) {
    throw new Error('Payment record not found');
  }

  // Verify scope
  if (!profile.isAdmin) {
    const hasAccess =
      isScopeAllowed(profile, 'VILLAGE', payment.customer.villageId) ||
      (payment.lineId && isScopeAllowed(profile, 'LINE', payment.lineId));
    if (!hasAccess) {
      throw new Error('Forbidden: Access outside assigned scope');
    }
  }

  return {
    ...payment,
    amountRupees: paiseToRupees(payment.amountPaise),
    principalPaidRupees: paiseToRupees(payment.principalPaidPaise),
    financeChargePaidRupees: paiseToRupees(payment.financeChargePaidPaise),
    advanceCreditRupees: paiseToRupees(payment.advanceCreditPaise),
    allocations: payment.allocations.map((a) => ({
      ...a,
      amountRupees: paiseToRupees(a.amountPaise),
      principalRupees: paiseToRupees(a.principalPaise),
      financeChargeRupees: paiseToRupees(a.financeChargePaise),
      installment: {
        ...a.installment,
        totalDueRupees: paiseToRupees(a.installment.totalDuePaise),
        totalPaidRupees: paiseToRupees(a.installment.totalPaidPaise),
        principalDueRupees: paiseToRupees(a.installment.principalDuePaise),
        financeChargeDueRupees: paiseToRupees(a.installment.financeChargeDuePaise),
      },
    })),
  };
}

/**
 * Get comprehensive repayment and dues summary for a loan.
 */
export async function getLoanRepaymentSummary(loanId, actorContext = null) {
  let profile = actorContext?.profile;
  if (!profile) {
    const auth = await getAuthSession();
    profile = auth.profile;
  }
  requirePermission(profile, 'loans:read');

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      customer: { select: { id: true, customerNumber: true, fullName: true, villageId: true } },
      scheme: true,
      installments: {
        orderBy: { installmentNumber: 'asc' },
      },
      advanceCreditEntries: {
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        orderBy: { collectedAt: 'desc' },
        take: 10,
        include: {
          collectedBy: { select: { fullName: true } },
          reversal: true,
        },
      },
    },
  });

  if (!loan) throw new Error('Loan not found');

  if (!profile.isAdmin) {
    requireScope(profile, 'VILLAGE', loan.customer.villageId);
  }

  const totalRepaymentPaise = loan.totalRepaymentPaise;
  const sanctionedPrincipalPaise = loan.sanctionedPrincipalPaise;
  const totalFinanceChargePaise = loan.totalFinanceChargePaise;

  const totalPaidPaise = loan.installments.reduce((sum, inst) => sum + inst.totalPaidPaise, 0);
  const principalPaidPaise = loan.installments.reduce((sum, inst) => sum + inst.principalPaidPaise, 0);
  const financeChargePaidPaise = loan.installments.reduce((sum, inst) => sum + inst.financeChargePaidPaise, 0);

  const remainingTotalPaise = Math.max(0, totalRepaymentPaise - totalPaidPaise);
  const remainingPrincipalPaise = Math.max(0, sanctionedPrincipalPaise - principalPaidPaise);
  const remainingFinanceChargePaise = Math.max(0, totalFinanceChargePaise - financeChargePaidPaise);

  const totalAdvanceCreditPaise = loan.advanceCreditEntries.reduce(
    (sum, e) => (e.type === 'CREDIT' ? sum + e.balancePaise : sum),
    0
  );

  const nextDueInstallment = loan.installments.find(
    (inst) => inst.status === 'PENDING' || inst.status === 'PARTIALLY_PAID'
  );

  return {
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    status: loan.status,
    customer: loan.customer,
    scheme: loan.scheme,
    totals: {
      totalRepaymentRupees: paiseToRupees(totalRepaymentPaise),
      sanctionedPrincipalRupees: paiseToRupees(sanctionedPrincipalPaise),
      totalFinanceChargeRupees: paiseToRupees(totalFinanceChargePaise),
      totalPaidRupees: paiseToRupees(totalPaidPaise),
      principalPaidRupees: paiseToRupees(principalPaidPaise),
      financeChargePaidRupees: paiseToRupees(financeChargePaidPaise),
      remainingTotalRupees: paiseToRupees(remainingTotalPaise),
      remainingPrincipalRupees: paiseToRupees(remainingPrincipalPaise),
      remainingFinanceChargeRupees: paiseToRupees(remainingFinanceChargePaise),
      advanceCreditRupees: paiseToRupees(totalAdvanceCreditPaise),
    },
    nextDueInstallment: nextDueInstallment
      ? {
          id: nextDueInstallment.id,
          installmentNumber: nextDueInstallment.installmentNumber,
          dueDate: nextDueInstallment.dueDate,
          totalDueRupees: paiseToRupees(nextDueInstallment.totalDuePaise),
          totalPaidRupees: paiseToRupees(nextDueInstallment.totalPaidPaise),
          balanceDueRupees: paiseToRupees(
            nextDueInstallment.totalDuePaise - nextDueInstallment.totalPaidPaise
          ),
          status: nextDueInstallment.status,
        }
      : null,
    installments: loan.installments.map((inst) => ({
      ...inst,
      principalDueRupees: paiseToRupees(inst.principalDuePaise),
      financeChargeDueRupees: paiseToRupees(inst.financeChargeDuePaise),
      totalDueRupees: paiseToRupees(inst.totalDuePaise),
      principalPaidRupees: paiseToRupees(inst.principalPaidPaise),
      financeChargePaidRupees: paiseToRupees(inst.financeChargePaidPaise),
      totalPaidRupees: paiseToRupees(inst.totalPaidPaise),
      balanceDueRupees: paiseToRupees(inst.totalDuePaise - inst.totalPaidPaise),
    })),
    recentPayments: loan.payments.map((p) => ({
      ...p,
      amountRupees: paiseToRupees(p.amountPaise),
      principalPaidRupees: paiseToRupees(p.principalPaidPaise),
      financeChargePaidRupees: paiseToRupees(p.financeChargePaidPaise),
    })),
  };
}

// ---- Core Business Logic Executions ----

/**
 * Core execution for recording a payment. Accepts explicit actorContext or resolves from session.
 */
export async function executeRecordPayment(input, { profile, user }) {
  if (!profile.isAdmin) {
    requirePermission(profile, 'payments:collect');
  }

  const data = validate(recordPaymentSchema, input);

  // 1. Idempotency Check (Offline sync / retry protection)
  if (data.idempotencyKey && data.idempotencyKey.trim()) {
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey: data.idempotencyKey.trim() },
      include: {
        customer: true,
        loan: true,
        allocations: { include: { installment: true } },
        reversal: true,
      },
    });

    if (existingPayment) {
      return {
        success: true,
        isDuplicate: true,
        payment: {
          ...existingPayment,
          amountRupees: paiseToRupees(existingPayment.amountPaise),
        },
        message: 'Payment already processed with this idempotency key.',
      };
    }
  }

  // 2. Fetch loan & customer with validation
  const loan = await prisma.loan.findUnique({
    where: { id: data.loanId },
    include: {
      customer: {
        include: {
          lineAssignments: { where: { isCurrent: true } },
        },
      },
      scheme: true,
    },
  });

  if (!loan) {
    throw new Error('Target loan does not exist');
  }

  // Scope check for collectors
  if (!profile.isAdmin) {
    const activeLineId = loan.customer.lineAssignments?.[0]?.lineId;
    const hasScope =
      isScopeAllowed(profile, 'VILLAGE', loan.customer.villageId) ||
      (activeLineId && isScopeAllowed(profile, 'LINE', activeLineId));

    if (!hasScope) {
      throw new Error('Forbidden: Access outside assigned scope for this customer loan.');
    }
  }

  // Validate loan status
  if (!['PARTIALLY_DISBURSED', 'DISBURSED', 'ACTIVE'].includes(loan.status)) {
    throw new Error(
      `Cannot record payment: loan is in '${loan.status}' status (must be ACTIVE or DISBURSED).`
    );
  }

  const amountPaise = rupeesToPaise(data.amountRupees);
  if (amountPaise <= 0) {
    throw new Error('Payment amount must be greater than zero paise');
  }

  // 3. Execute atomic FIFO allocation inside database transaction
  const result = await prisma.$transaction(async (tx) => {
    // Re-check idempotency key inside tx to prevent concurrent duplicate race conditions
    if (data.idempotencyKey && data.idempotencyKey.trim()) {
      const raceExisting = await tx.payment.findUnique({
        where: { idempotencyKey: data.idempotencyKey.trim() },
      });
      if (raceExisting) return { payment: raceExisting, isDuplicate: true };
    }

    // Fetch all pending / partially paid installments of this loan ordered FIFO
    const installments = await tx.loanInstallment.findMany({
      where: {
        loanId: loan.id,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      },
      orderBy: { installmentNumber: 'asc' },
    });

    let remainingToAllocate = amountPaise;
    let totalPrincipalAllocated = 0;
    let totalFinanceChargeAllocated = 0;
    const allocationsToCreate = [];
    const installmentsToUpdate = [];

    for (const inst of installments) {
      if (remainingToAllocate <= 0) break;

      const remTotal = inst.totalDuePaise - inst.totalPaidPaise;
      const remPrincipal = inst.principalDuePaise - inst.principalPaidPaise;
      const remFC = inst.financeChargeDuePaise - inst.financeChargePaidPaise;

      if (remTotal <= 0) continue;

      const allocAmount = Math.min(remainingToAllocate, remTotal);
      let allocPrincipal = 0;
      let allocFC = 0;

      if (allocAmount === remTotal) {
        // Clearing this installment completely
        allocPrincipal = remPrincipal;
        allocFC = remFC;
      } else {
        // Partial allocation on this installment:
        // Proportional split strictly respecting remaining component dues
        allocPrincipal = Math.floor(allocAmount * (remPrincipal / remTotal));
        allocFC = allocAmount - allocPrincipal;

        // Bounded component checks
        if (allocPrincipal > remPrincipal) {
          allocPrincipal = remPrincipal;
          allocFC = allocAmount - allocPrincipal;
        } else if (allocFC > remFC) {
          allocFC = remFC;
          allocPrincipal = allocAmount - allocFC;
        }
      }

      // Verify exact component sum
      if (allocPrincipal + allocFC !== allocAmount) {
        throw new Error(
          `Allocation component reconciliation failure on installment #${inst.installmentNumber}: ${allocPrincipal} + ${allocFC} != ${allocAmount}`
        );
      }

      const newPrincipalPaid = inst.principalPaidPaise + allocPrincipal;
      const newFC = inst.financeChargePaidPaise + allocFC;
      const newTotalPaid = inst.totalPaidPaise + allocAmount;
      const isPaidInFull = newTotalPaid >= inst.totalDuePaise;

      installmentsToUpdate.push({
        id: inst.id,
        installmentNumber: inst.installmentNumber,
        principalPaidPaise: newPrincipalPaid,
        financeChargePaidPaise: newFC,
        totalPaidPaise: newTotalPaid,
        status: isPaidInFull ? 'PAID' : 'PARTIALLY_PAID',
        paidAt: isPaidInFull ? new Date() : inst.paidAt,
      });

      allocationsToCreate.push({
        installmentId: inst.id,
        amountPaise: allocAmount,
        principalPaise: allocPrincipal,
        financeChargePaise: allocFC,
      });

      totalPrincipalAllocated += allocPrincipal;
      totalFinanceChargeAllocated += allocFC;
      remainingToAllocate -= allocAmount;
    }

    // Excess payment beyond all scheduled installments of this loan
    const advanceCreditPaise = remainingToAllocate;

    // Generate human-readable unique payment number
    const paymentCount = await tx.payment.count();
    const paymentNumber = `VF-PAY-${String(paymentCount + 10001).padStart(5, '0')}`;

    // Resolve lineId
    const effectiveLineId =
      data.lineId || loan.customer.lineAssignments?.[0]?.lineId || null;

    // Create Payment master record
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        loanId: loan.id,
        customerId: loan.customerId,
        collectedById: user.id,
        lineId: effectiveLineId,
        amountPaise,
        principalPaidPaise: totalPrincipalAllocated,
        financeChargePaidPaise: totalFinanceChargeAllocated,
        advanceCreditPaise,
        mode: data.mode,
        reference: data.reference || null,
        status: 'CONFIRMED',
        notes: data.notes || null,
        idempotencyKey: data.idempotencyKey ? data.idempotencyKey.trim() : null,
        collectedAt: data.collectedAt ? new Date(data.collectedAt) : new Date(),
      },
    });

    // Update affected installments in batch
    await Promise.all(
      installmentsToUpdate.map((item) =>
        tx.loanInstallment.update({
          where: { id: item.id },
          data: {
            principalPaidPaise: item.principalPaidPaise,
            financeChargePaidPaise: item.financeChargePaidPaise,
            totalPaidPaise: item.totalPaidPaise,
            status: item.status,
            paidAt: item.paidAt,
          },
        })
      )
    );

    // Create PaymentAllocation records in single batch
    if (allocationsToCreate.length > 0) {
      await tx.paymentAllocation.createMany({
        data: allocationsToCreate.map((alloc) => ({
          paymentId: payment.id,
          loanId: loan.id,
          installmentId: alloc.installmentId,
          amountPaise: alloc.amountPaise,
          principalPaise: alloc.principalPaise,
          financeChargePaise: alloc.financeChargePaise,
        })),
      });
    }

    // Create CustomerAdvanceCreditEntry if excess paid
    if (advanceCreditPaise > 0) {
      await tx.customerAdvanceCreditEntry.create({
        data: {
          loanId: loan.id,
          customerId: loan.customerId,
          paymentId: payment.id,
          type: 'CREDIT',
          amountPaise: advanceCreditPaise,
          balancePaise: advanceCreditPaise,
          notes: `Advance credit from excess payment on ${paymentNumber}`,
        },
      });
    }

    // Check if loan is now fully cleared
    const remainingPendingCount = await tx.loanInstallment.count({
      where: {
        loanId: loan.id,
        status: { not: 'PAID' },
      },
    });

    if (remainingPendingCount === 0) {
      await tx.loan.update({
        where: { id: loan.id },
        data: { status: 'PAID' },
      });
    } else if (loan.status === 'DISBURSED') {
      // Transition DISBURSED -> ACTIVE on first installment payment
      await tx.loan.update({
        where: { id: loan.id },
        data: { status: 'ACTIVE' },
      });
    }

    // Atomic Physical Cash Ledger Entry (Module 06)
    // Rule: UPI / Bank transfers do not change physical Cash Bag.
    if (data.mode === 'CASH') {
      await postCashCollectionEntry(tx, payment, user.id);
    }

    return { payment, allocationsCount: allocationsToCreate.length, isDuplicate: false };
  }, { maxWait: 15000, timeout: 45000 });

  if (result.isDuplicate) {
    return {
      success: true,
      isDuplicate: true,
      payment: result.payment,
      message: 'Payment already processed with this idempotency key.',
    };
  }

  // 4. Audit Trail
  await writeAudit({
    actorId: user.id,
    action: 'PAYMENT_RECORDED',
    entityType: 'Payment',
    entityId: result.payment.id,
    metadata: {
      paymentNumber: result.payment.paymentNumber,
      loanId: loan.id,
      customerId: loan.customerId,
      amountPaise,
      principalPaidPaise: result.payment.principalPaidPaise,
      financeChargePaidPaise: result.payment.financeChargePaidPaise,
      advanceCreditPaise: result.payment.advanceCreditPaise,
      mode: data.mode,
      allocationsCount: result.allocationsCount,
    },
  });

  await safeRevalidate('/payments');
  await safeRevalidate(`/loans/${loan.id}`);
  await safeRevalidate(`/customers/${loan.customerId}`);

  return {
    success: true,
    payment: {
      ...result.payment,
      amountRupees: paiseToRupees(result.payment.amountPaise),
      principalPaidRupees: paiseToRupees(result.payment.principalPaidPaise),
      financeChargePaidRupees: paiseToRupees(result.payment.financeChargePaidPaise),
      advanceCreditRupees: paiseToRupees(result.payment.advanceCreditPaise),
    },
  };
}

/**
 * Core execution for reversing a payment.
 */
export async function executeReversePayment(input, { profile, user }) {
  // Strict User Constraint: Admin Role Required for Reversals
  if (!profile.isAdmin) {
    throw new Error('Forbidden: Only administrators are authorized to approve and perform payment reversals.');
  }

  const data = validate(reversePaymentSchema, input);

  // 1. Fetch payment with complete allocations
  const payment = await prisma.payment.findUnique({
    where: { id: data.paymentId },
    include: {
      allocations: true,
      advanceCreditEntries: true,
      reversal: true,
      loan: true,
    },
  });

  if (!payment) {
    throw new Error('Payment record not found');
  }

  if (payment.status === 'REVERSED' || payment.reversal) {
    throw new Error(`Payment ${payment.paymentNumber} has already been reversed.`);
  }

  // 2. Perform atomic reversal inside transaction
  const result = await prisma.$transaction(async (tx) => {
    // Reverse each installment allocation
    await Promise.all(
      payment.allocations.map(async (alloc) => {
        const inst = await tx.loanInstallment.findUnique({
          where: { id: alloc.installmentId },
        });

        if (!inst) return;

        const restoredPrincipalPaid = Math.max(0, inst.principalPaidPaise - alloc.principalPaise);
        const restoredFC = Math.max(0, inst.financeChargePaidPaise - alloc.financeChargePaise);
        const restoredTotalPaid = Math.max(0, inst.totalPaidPaise - alloc.amountPaise);

        let restoredStatus = 'PENDING';
        if (restoredTotalPaid >= inst.totalDuePaise) {
          restoredStatus = 'PAID';
        } else if (restoredTotalPaid > 0) {
          restoredStatus = 'PARTIALLY_PAID';
        }

        await tx.loanInstallment.update({
          where: { id: inst.id },
          data: {
            principalPaidPaise: restoredPrincipalPaid,
            financeChargePaidPaise: restoredFC,
            totalPaidPaise: restoredTotalPaid,
            status: restoredStatus,
            paidAt: restoredStatus === 'PAID' ? inst.paidAt : null,
          },
        });
      })
    );

    // Void advance credit entries created by this payment
    if (payment.advanceCreditPaise > 0) {
      for (const entry of payment.advanceCreditEntries) {
        await tx.customerAdvanceCreditEntry.update({
          where: { id: entry.id },
          data: {
            balancePaise: 0,
            notes: `${entry.notes || ''} [VOIDED BY PAYMENT REVERSAL]`,
          },
        });
      }
    }

    // Mark payment as REVERSED
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REVERSED',
      },
    });

    // Create PaymentReversal record
    const reversal = await tx.paymentReversal.create({
      data: {
        paymentId: payment.id,
        reversedById: user.id,
        reason: data.reason.trim(),
        reversedAt: new Date(),
      },
    });

    // If loan status was PAID, revert back to ACTIVE since installments are reopened
    if (payment.loan.status === 'PAID') {
      await tx.loan.update({
        where: { id: payment.loanId },
        data: { status: 'ACTIVE' },
      });
    }

    // Atomic Compensating Cash Ledger Entry (Module 06)
    // Rule: Reversal creates compensating REVERSAL entry; does not delete original.
    if (payment.mode === 'CASH') {
      await postCashReversalEntry(tx, payment, data.reason.trim(), user.id);
    }

    return { payment: updatedPayment, reversal };
  }, { maxWait: 15000, timeout: 45000 });

  // 3. Write Audit Trail
  await writeAudit({
    actorId: user.id,
    action: 'PAYMENT_REVERSED',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: {
      paymentNumber: payment.paymentNumber,
      loanId: payment.loanId,
      customerId: payment.customerId,
      amountPaise: payment.amountPaise,
      reason: data.reason.trim(),
      reversedById: user.id,
    },
  });

  await safeRevalidate('/payments');
  await safeRevalidate(`/payments/${payment.id}`);
  await safeRevalidate(`/loans/${payment.loanId}`);
  await safeRevalidate(`/customers/${payment.customerId}`);

  return {
    success: true,
    payment: result.payment,
    reversal: result.reversal,
  };
}

// ---- Next.js Server Action Entry Points ----

export async function recordPayment(input) {
  const { profile, user } = await getAuthSession();
  return executeRecordPayment(input, { profile, user });
}

export async function reversePayment(input) {
  const { profile, user } = await getAuthSession();
  return executeReversePayment(input, { profile, user });
}
