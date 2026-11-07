'use server';

/**
 * Loan Products, Schemes, Applications, Approvals & Disbursements
 * Module 03 — Village Finance
 *
 * Implements:
 * - Four confirmed schemes with exact integer paise reconciliation
 * - Immutable schedule snapshots generated on first completed disbursement
 * - Anti-tampering & strict separation of duties (no self-approval)
 * - Explicit Admin override for overlapping active loans
 * - Partial disbursement cancellation with principal-only recovery
 * - Comprehensive audit logging for all loan lifecycle mutations
 */
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission, isScopeAllowed, requireScope } from '@/lib/permissions';
import { writeAudit } from '@/lib/audit';
import { validate, z } from '@/lib/validation';
import { rupeesToPaise, paiseToRupees } from '@/lib/money';
import { revalidatePath } from 'next/cache';

// ---- Validation Schemas ----

const createLoanSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  schemeId: z.string().uuid('Invalid scheme ID'),
  requestedPrincipalRupees: z.number().positive('Principal must be greater than zero'),
  notes: z.string().optional().nullable(),
});

const approveLoanSchema = z.object({
  loanId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional().nullable(),
  overlappingApprovalReason: z.string().optional().nullable(),
});

const disburseLoanSchema = z.object({
  loanId: z.string().uuid(),
  amountRupees: z.number().positive('Disbursement amount must be positive'),
  mode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI']).default('CASH'),
  reference: z.string().optional().nullable(),
  lineId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  firstInstallmentDueDate: z.string().optional().nullable(),
});

const cancelLoanSchema = z.object({
  loanId: z.string().uuid(),
  reason: z.string().min(5, 'Reason for cancellation is required (min 5 characters)'),
});

/**
 * Fetch all active Loan Schemes and their active versions + rules.
 * Requires: schemes:read or loans:apply or loans:read
 */
export async function getLoanSchemes() {
  const schemes = await prisma.loanScheme.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { versionNumber: 'desc' },
        take: 1,
        include: {
          installmentRules: {
            orderBy: { installmentNumber: 'asc' },
          },
        },
      },
    },
  });

  return schemes.map((s) => {
    const v = s.versions[0];
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      frequency: s.frequency,
      description: s.description,
      currentVersion: v
        ? {
            id: v.id,
            versionNumber: v.versionNumber,
            principalRupees: paiseToRupees(v.principalPaise),
            totalFinanceChargeRupees: paiseToRupees(v.totalFinanceChargePaise),
            totalRepaymentRupees: paiseToRupees(v.totalRepaymentPaise),
            installmentCount: v.installmentCount,
            rules: v.installmentRules.map((r) => ({
              installmentNumber: r.installmentNumber,
              dueOffsetDays: r.dueOffsetDays,
              principalDueRupees: paiseToRupees(r.principalDuePaise),
              financeChargeDueRupees: paiseToRupees(r.financeChargeDuePaise),
              totalDueRupees: paiseToRupees(r.totalDuePaise),
            })),
          }
        : null,
    };
  });
}

/**
 * Fetch list of loans with filters, search, and scope isolation.
 * Requires: loans:read
 */
export async function getLoansList({
  search = '',
  status = 'ALL',
  schemeId = 'ALL',
  limit = 50,
  offset = 0,
} = {}) {
  const { profile } = await requireAuth();
  requirePermission(profile, 'loans:read');

  const where = {};

  if (status !== 'ALL') {
    where.status = status;
  }

  if (schemeId !== 'ALL') {
    where.schemeId = schemeId;
  }

  if (search.trim()) {
    const s = search.trim();
    where.OR = [
      { loanNumber: { contains: s, mode: 'insensitive' } },
      { customer: { fullName: { contains: s, mode: 'insensitive' } } },
      { customer: { customerNumber: { contains: s, mode: 'insensitive' } } },
      { customer: { phones: { some: { phoneNumber: { contains: s } } } } },
    ];
  }

  // Data scope isolation: If not admin, restrict to customer villages/lines
  if (!profile.isAdmin) {
    const hasAll = profile.dataScopes.some((ds) => ds.scopeType === 'ALL' || ds.scopeValue === '*');
    if (!hasAll) {
      const allowedVillages = profile.dataScopes
        .filter((ds) => ds.scopeType === 'VILLAGE')
        .map((ds) => ds.scopeValue);
      const allowedLines = profile.dataScopes
        .filter((ds) => ds.scopeType === 'LINE')
        .map((ds) => ds.scopeValue);

      where.customer = {
        AND: [
          {
            OR: [
              ...(allowedVillages.length > 0 ? [{ villageId: { in: allowedVillages } }] : []),
              ...(allowedLines.length > 0
                ? [{ lineAssignments: { some: { lineId: { in: allowedLines }, isCurrent: true } } }]
                : []),
            ],
          },
        ],
      };
    }
  }

  const [loans, totalCount] = await Promise.all([
    prisma.loan.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            fullName: true,
            village: { select: { name: true } },
            phones: { where: { isPrimary: true }, take: 1 },
          },
        },
        scheme: { select: { name: true, code: true, frequency: true } },
        applicant: { select: { fullName: true } },
        disbursements: { select: { amountPaise: true } },
      },
    }),
    prisma.loan.count({ where }),
  ]);

  return {
    totalCount,
    loans: loans.map((l) => {
      const totalDisbursedPaise = l.disbursements.reduce((acc, d) => acc + d.amountPaise, 0);
      return {
        id: l.id,
        loanNumber: l.loanNumber,
        status: l.status,
        customerName: l.customer.fullName,
        customerNumber: l.customer.customerNumber,
        villageName: l.customer.village?.name || '—',
        primaryPhone: l.customer.phones[0]?.phoneNumber || '—',
        schemeName: l.scheme.name,
        schemeCode: l.scheme.code,
        frequency: l.scheme.frequency,
        sanctionedPrincipalRupees: paiseToRupees(l.sanctionedPrincipalPaise),
        totalRepaymentRupees: paiseToRupees(l.totalRepaymentPaise),
        totalFinanceChargeRupees: paiseToRupees(l.totalFinanceChargePaise),
        totalDisbursedRupees: paiseToRupees(totalDisbursedPaise),
        applicantName: l.applicant.fullName,
        isOverlapping: l.isOverlapping,
        createdAt: l.createdAt.toISOString(),
      };
    }),
  };
}

/**
 * Fetch detailed loan profile, schedule, disbursements, and audit trail.
 * Requires: loans:read
 */
export async function getLoanDetails(loanId) {
  const { profile } = await requireAuth();
  requirePermission(profile, 'loans:read');

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      customer: {
        include: {
          village: true,
          area: true,
          phones: { where: { isPrimary: true }, take: 1 },
          lineAssignments: { where: { isCurrent: true }, include: { line: true }, take: 1 },
        },
      },
      scheme: true,
      schemeVersion: true,
      applicant: { select: { id: true, fullName: true, email: true } },
      approvals: {
        orderBy: { decidedAt: 'desc' },
        include: { approver: { select: { fullName: true, email: true } } },
      },
      disbursements: {
        orderBy: { disbursementNumber: 'asc' },
        include: {
          disburser: { select: { fullName: true } },
          line: { select: { name: true, code: true } },
        },
      },
      scheduleVersions: {
        where: { isCurrent: true },
        include: {
          installments: {
            orderBy: { installmentNumber: 'asc' },
          },
        },
      },
      cancellation: {
        include: {
          canceller: { select: { fullName: true } },
          recoveries: { include: { recorder: { select: { fullName: true } } } },
        },
      },
      payments: {
        orderBy: { collectedAt: 'desc' },
        include: {
          collectedBy: { select: { fullName: true } },
          reversal: true,
        },
      },
    },
  });

  if (!loan) throw new Error('Loan not found');

  // Verify data scope
  const currentLineId = loan.customer.lineAssignments[0]?.lineId;
  if (!profile.isAdmin) {
    const villageAllowed = isScopeAllowed(profile, 'VILLAGE', loan.customer.villageId);
    const lineAllowed = currentLineId ? isScopeAllowed(profile, 'LINE', currentLineId) : false;
    if (!villageAllowed && !lineAllowed) {
      requireScope(profile, 'VILLAGE', loan.customer.villageId);
    }
  }

  const currentSchedule = loan.scheduleVersions[0] || null;
  const totalDisbursedPaise = loan.disbursements.reduce((acc, d) => acc + d.amountPaise, 0);

  return {
    id: loan.id,
    loanNumber: loan.loanNumber,
    status: loan.status,
    notes: loan.notes,
    isOverlapping: loan.isOverlapping,
    overlappingApprovalReason: loan.overlappingApprovalReason,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),

    // Financials in Rupees
    requestedPrincipalRupees: paiseToRupees(loan.requestedPrincipalPaise),
    sanctionedPrincipalRupees: paiseToRupees(loan.sanctionedPrincipalPaise),
    totalFinanceChargeRupees: paiseToRupees(loan.totalFinanceChargePaise),
    totalRepaymentRupees: paiseToRupees(loan.totalRepaymentPaise),
    totalDisbursedRupees: paiseToRupees(totalDisbursedPaise),
    remainingDisbursableRupees: paiseToRupees(
      Math.max(0, loan.sanctionedPrincipalPaise - totalDisbursedPaise)
    ),

    // Relationships
    customer: {
      id: loan.customer.id,
      customerNumber: loan.customer.customerNumber,
      fullName: loan.customer.fullName,
      villageName: loan.customer.village.name,
      areaName: loan.customer.area?.name || '—',
      primaryPhone: loan.customer.phones[0]?.phoneNumber || '—',
      currentLine: loan.customer.lineAssignments[0]?.line?.name || 'Unassigned',
      currentLineId: loan.customer.lineAssignments[0]?.lineId || null,
    },
    scheme: {
      id: loan.scheme.id,
      name: loan.scheme.name,
      code: loan.scheme.code,
      frequency: loan.scheme.frequency,
    },
    applicant: loan.applicant,
    approvals: loan.approvals.map((a) => ({
      id: a.id,
      decision: a.decision,
      reason: a.reason,
      approverName: a.approver.fullName,
      decidedAt: a.decidedAt.toISOString(),
      termsSnapshot: a.termsSnapshot,
    })),
    disbursements: loan.disbursements.map((d) => ({
      id: d.id,
      disbursementNumber: d.disbursementNumber,
      amountRupees: paiseToRupees(d.amountPaise),
      disbursedAt: d.disbursedAt.toISOString(),
      mode: d.mode,
      reference: d.reference || '—',
      disburserName: d.disburser.fullName,
      lineName: d.line?.name || null,
      notes: d.notes,
    })),
    schedule: currentSchedule
      ? {
          versionNumber: currentSchedule.versionNumber,
          generatedAt: currentSchedule.generatedAt.toISOString(),
          generatedReason: currentSchedule.generatedReason,
          totalPrincipalRupees: paiseToRupees(currentSchedule.totalPrincipalPaise),
          totalFinanceChargeRupees: paiseToRupees(currentSchedule.totalFinanceChargePaise),
          totalRepaymentRupees: paiseToRupees(currentSchedule.totalRepaymentPaise),
          installments: currentSchedule.installments.map((inst) => ({
            id: inst.id,
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate.toISOString(),
            status: inst.status,
            principalDueRupees: paiseToRupees(inst.principalDuePaise),
            financeChargeDueRupees: paiseToRupees(inst.financeChargeDuePaise),
            totalDueRupees: paiseToRupees(inst.totalDuePaise),
            totalPaidRupees: paiseToRupees(inst.totalPaidPaise),
          })),
        }
      : null,
    payments: (loan.payments || []).map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      amountRupees: paiseToRupees(p.amountPaise),
      principalPaidRupees: paiseToRupees(p.principalPaidPaise),
      financeChargePaidRupees: paiseToRupees(p.financeChargePaidPaise),
      advanceCreditRupees: paiseToRupees(p.advanceCreditPaise),
      mode: p.mode,
      reference: p.reference,
      status: p.status,
      collectedAt: p.collectedAt.toISOString(),
      collectorName: p.collectedBy.fullName,
      isReversed: p.status === 'REVERSED',
    })),
    cancellation: loan.cancellation
      ? {
          cancelledAt: loan.cancellation.cancelledAt.toISOString(),
          cancelledByName: loan.cancellation.canceller.fullName,
          reason: loan.cancellation.reason,
          disbursedPrincipalRupees: paiseToRupees(loan.cancellation.disbursedPrincipalPaise),
          repaidPrincipalRupees: paiseToRupees(loan.cancellation.repaidPrincipalPaise),
          netRecoverablePrincipalRupees: paiseToRupees(
            loan.cancellation.netRecoverablePrincipalPaise
          ),
          status: loan.cancellation.status,
          recoveries: loan.cancellation.recoveries.map((rec) => ({
            id: rec.id,
            amountRupees: paiseToRupees(rec.amountPaise),
            paymentReference: rec.paymentReference,
            recordedByName: rec.recorder.fullName,
            recordedAt: rec.recordedAt.toISOString(),
          })),
        }
      : null,
  };
}

/**
 * Submit a new Loan Application.
 * Requires: loans:apply
 */
export async function createLoanApplication(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'loans:apply');

  const data = validate(createLoanSchema, input);

  // 1. Verify customer status & active scope
  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    include: {
      lineAssignments: { where: { isCurrent: true }, take: 1 },
      loans: {
        where: {
          status: { in: ['SUBMITTED', 'APPROVED', 'PARTIALLY_DISBURSED', 'DISBURSED', 'ACTIVE'] },
        },
      },
    },
  });

  if (!customer) throw new Error('Customer not found');
  if (customer.status !== 'ACTIVE') {
    throw new Error(`Cannot create loan application for customer with status ${customer.status}`);
  }

  // Verify scope
  if (!profile.isAdmin) {
    const currentLineId = customer.lineAssignments[0]?.lineId;
    const villageAllowed = isScopeAllowed(profile, 'VILLAGE', customer.villageId);
    const lineAllowed = currentLineId ? isScopeAllowed(profile, 'LINE', currentLineId) : false;
    if (!villageAllowed && !lineAllowed) {
      requireScope(profile, 'VILLAGE', customer.villageId);
    }
  }

  // Check overlapping active loans
  const hasActiveLoan = customer.loans.length > 0;

  // 2. Load the scheme and its active version
  const scheme = await prisma.loanScheme.findUnique({
    where: { id: data.schemeId },
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  });

  if (!scheme || scheme.versions.length === 0) {
    throw new Error('Selected loan scheme does not have an active version configured');
  }

  const schemeVersion = scheme.versions[0];
  const requestedPrincipalPaise = rupeesToPaise(data.requestedPrincipalRupees);

  // Validate that requested principal matches scheme terms
  if (requestedPrincipalPaise !== schemeVersion.principalPaise) {
    throw new Error(
      `Requested principal ₹${data.requestedPrincipalRupees} does not match scheme principal ₹${paiseToRupees(
        schemeVersion.principalPaise
      )}`
    );
  }

  // 3. Generate sequential loan number
  const count = await prisma.loan.count();
  const loanNumber = `VF-LN-${String(count + 10001).padStart(5, '0')}`;

  const loan = await prisma.$transaction(async (tx) => {
    const newLoan = await tx.loan.create({
      data: {
        loanNumber,
        customerId: customer.id,
        schemeId: scheme.id,
        schemeVersionId: schemeVersion.id,
        requestedPrincipalPaise: schemeVersion.principalPaise,
        sanctionedPrincipalPaise: schemeVersion.principalPaise,
        totalFinanceChargePaise: schemeVersion.totalFinanceChargePaise,
        totalRepaymentPaise: schemeVersion.totalRepaymentPaise,
        status: 'SUBMITTED',
        applicantId: user.id,
        notes: data.notes || null,
        isOverlapping: hasActiveLoan,
      },
    });

    await writeAudit({
      actorId: user.id,
      action: 'LOAN_APPLICATION_CREATED',
      entityType: 'Loan',
      entityId: newLoan.id,
      metadata: {
        loanNumber,
        customerId: customer.id,
        schemeCode: scheme.code,
        isOverlapping: hasActiveLoan,
      },
      tx,
    });

    return newLoan;
  });

  revalidatePath('/loans');
  revalidatePath(`/customers/${customer.id}`);
  return { success: true, loanId: loan.id, loanNumber: loan.loanNumber };
}

/**
 * Approve or Reject a Loan Application.
 * Requires: loans:approve
 * Rules:
 * - Anti-tampering: Applicant CANNOT approve their own loan application (Strict separation).
 * - Overlapping active loan requires ADMIN role + documented reason.
 */
export async function approveLoanApplication(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'loans:approve');

  const data = validate(approveLoanSchema, input);

  const loan = await prisma.loan.findUnique({
    where: { id: data.loanId },
    include: {
      schemeVersion: true,
      scheme: true,
    },
  });

  if (!loan) throw new Error('Loan not found');
  if (loan.status !== 'SUBMITTED') {
    throw new Error(`Cannot decide loan in status "${loan.status}". Must be SUBMITTED.`);
  }

  // Rule 1: Strict Separation of Duties (No Self-Approval)
  if (loan.applicantId === user.id) {
    throw new Error(
      'Strict separation of duties: You cannot approve or reject a loan application you submitted. Another authorized officer or administrator must review it.'
    );
  }

  // Rule 2: Overlapping active loan requires ADMIN role + justification
  if (loan.isOverlapping && data.decision === 'APPROVED') {
    if (!profile.isAdmin) {
      throw new Error(
        'Policy restriction: Customer already has an active loan. Only an Administrator can approve an overlapping loan.'
      );
    }
    if (!data.overlappingApprovalReason || data.overlappingApprovalReason.trim().length < 5) {
      throw new Error(
        'Admin justification is required to approve an overlapping loan (minimum 5 characters).'
      );
    }
  }

  const termsSnapshot = {
    schemeCode: loan.scheme.code,
    schemeName: loan.scheme.name,
    sanctionedPrincipalPaise: loan.sanctionedPrincipalPaise,
    totalFinanceChargePaise: loan.totalFinanceChargePaise,
    totalRepaymentPaise: loan.totalRepaymentPaise,
    installmentCount: loan.schemeVersion.installmentCount,
    sanctionedPrincipalRupees: paiseToRupees(loan.sanctionedPrincipalPaise),
    totalRepaymentRupees: paiseToRupees(loan.totalRepaymentPaise),
  };

  await prisma.$transaction(async (tx) => {
    // 1. Record LoanApproval decision
    await tx.loanApproval.create({
      data: {
        loanId: loan.id,
        approverId: user.id,
        decision: data.decision,
        reason: data.reason || null,
        termsSnapshot,
      },
    });

    // 2. Update Loan status
    const newStatus = data.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    await tx.loan.update({
      where: { id: loan.id },
      data: {
        status: newStatus,
        overlappingApprovalReason:
          data.decision === 'APPROVED' ? data.overlappingApprovalReason || null : null,
      },
    });

    // 3. Audit log
    await writeAudit({
      actorId: user.id,
      action: data.decision === 'APPROVED' ? 'LOAN_APPROVED' : 'LOAN_REJECTED',
      entityType: 'Loan',
      entityId: loan.id,
      metadata: {
        decision: data.decision,
        loanNumber: loan.loanNumber,
        isOverlapping: loan.isOverlapping,
      },
      tx,
    });
  });

  revalidatePath(`/loans/${loan.id}`);
  revalidatePath('/loans');
  return { success: true };
}

/**
 * Disburse Loan Funds (Full or Partial).
 * Requires: loans:disburse
 * Rules:
 * - Completed disbursements cannot exceed sanctioned principal.
 * - The FIRST completed disbursement generates the fixed repayment schedule snapshot.
 * - Subsequent disbursements do NOT rewrite/regenerate the schedule.
 */
export async function disburseLoan(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'loans:disburse');

  const data = validate(disburseLoanSchema, input);

  const loan = await prisma.loan.findUnique({
    where: { id: data.loanId },
    include: {
      schemeVersion: {
        include: {
          installmentRules: {
            orderBy: { installmentNumber: 'asc' },
          },
        },
      },
      disbursements: true,
      scheduleVersions: { where: { isCurrent: true } },
    },
  });

  if (!loan) throw new Error('Loan not found');
  if (loan.status !== 'APPROVED' && loan.status !== 'PARTIALLY_DISBURSED') {
    throw new Error(`Cannot disburse loan in status "${loan.status}". Must be APPROVED or PARTIALLY_DISBURSED.`);
  }

  const newDisbursementPaise = rupeesToPaise(data.amountRupees);
  const alreadyDisbursedPaise = loan.disbursements.reduce((acc, d) => acc + d.amountPaise, 0);
  const totalAfterThisPaise = alreadyDisbursedPaise + newDisbursementPaise;

  if (totalAfterThisPaise > loan.sanctionedPrincipalPaise) {
    throw new Error(
      `Disbursement exceeds sanctioned limit. Maximum remaining disbursable: ₹${paiseToRupees(
        loan.sanctionedPrincipalPaise - alreadyDisbursedPaise
      )}`
    );
  }

  const isFirstDisbursement = loan.disbursements.length === 0;
  const nextDisbursementNumber = loan.disbursements.length + 1;
  const isFullyDisbursed = totalAfterThisPaise === loan.sanctionedPrincipalPaise;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Record LoanDisbursement
    const disbursement = await tx.loanDisbursement.create({
      data: {
        loanId: loan.id,
        disbursementNumber: nextDisbursementNumber,
        amountPaise: newDisbursementPaise,
        disbursedAt: now,
        mode: data.mode,
        reference: data.reference || null,
        disbursedBy: user.id,
        lineId: data.lineId || null,
        notes: data.notes || null,
      },
    });

    // 2. If first disbursement, generate immutable repayment schedule snapshot
    if (isFirstDisbursement) {
      const scheduleVersion = await tx.loanScheduleVersion.create({
        data: {
          loanId: loan.id,
          versionNumber: 1,
          generatedAt: now,
          generatedReason: 'INITIAL_DISBURSEMENT',
          totalPrincipalPaise: loan.schemeVersion.principalPaise,
          totalFinanceChargePaise: loan.schemeVersion.totalFinanceChargePaise,
          totalRepaymentPaise: loan.schemeVersion.totalRepaymentPaise,
          isCurrent: true,
        },
      });

      // Calculate installment due dates starting from firstInstallmentDueDate or default 7 days from now
      const baseDate = data.firstInstallmentDueDate
        ? new Date(data.firstInstallmentDueDate)
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const installmentInserts = loan.schemeVersion.installmentRules.map((rule, idx) => {
        // Due date: if first offset is provided, calculate offset relative to baseDate
        const dueDate = new Date(baseDate.getTime() + idx * (rule.dueOffsetDays / (idx + 1 || 1)) * 24 * 60 * 60 * 1000);

        return {
          scheduleVersionId: scheduleVersion.id,
          loanId: loan.id,
          installmentNumber: rule.installmentNumber,
          dueDate,
          principalDuePaise: rule.principalDuePaise,
          financeChargeDuePaise: rule.financeChargeDuePaise,
          totalDuePaise: rule.totalDuePaise,
          status: 'PENDING',
        };
      });

      await tx.loanInstallment.createMany({
        data: installmentInserts,
      });
    }

    // 3. Update Loan status
    const newStatus = isFullyDisbursed ? 'DISBURSED' : 'PARTIALLY_DISBURSED';
    await tx.loan.update({
      where: { id: loan.id },
      data: { status: newStatus },
    });

    // 4. Audit
    await writeAudit({
      actorId: user.id,
      action: 'LOAN_DISBURSED',
      entityType: 'LoanDisbursement',
      entityId: disbursement.id,
      metadata: {
        loanId: loan.id,
        disbursementNumber: nextDisbursementNumber,
        amountRupees: data.amountRupees,
        mode: data.mode,
        isFirstDisbursement,
        newStatus,
      },
      tx,
    });
  });

  revalidatePath(`/loans/${loan.id}`);
  revalidatePath('/loans');
  return { success: true };
}

/**
 * Cancel Loan with Principal-Only Recovery after partial or full disbursement.
 * Requires: ADMIN role
 * Rules:
 * - Voids all future pending installments (does not delete).
 * - Net recoverable principal = actual disbursed principal - repaid principal.
 * - Retains collected finance charge; adds zero future finance charge.
 * - Creates LoanCancellation with status PENDING_RECOVERY.
 */
export async function cancelLoanWithRecovery(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'loans:approve');

  if (!profile.isAdmin) {
    throw new Error('Only administrators are authorized to cancel disbursed loans with recovery.');
  }

  const data = validate(cancelLoanSchema, input);

  const loan = await prisma.loan.findUnique({
    where: { id: data.loanId },
    include: {
      disbursements: true,
      installments: true,
      cancellation: true,
    },
  });

  if (!loan) throw new Error('Loan not found');
  if (loan.cancellation) {
    throw new Error('This loan has already been cancelled.');
  }

  if (
    loan.status !== 'PARTIALLY_DISBURSED' &&
    loan.status !== 'DISBURSED' &&
    loan.status !== 'ACTIVE'
  ) {
    throw new Error(`Cannot execute recovery cancellation on loan in status "${loan.status}".`);
  }

  const totalDisbursedPaise = loan.disbursements.reduce((acc, d) => acc + d.amountPaise, 0);
  const totalPrincipalRepaidPaise = loan.installments.reduce(
    (acc, inst) => acc + inst.principalPaidPaise,
    0
  );
  const netRecoverablePrincipalPaise = Math.max(
    0,
    totalDisbursedPaise - totalPrincipalRepaidPaise
  );
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Void all pending or partially paid installments
    await tx.loanInstallment.updateMany({
      where: {
        loanId: loan.id,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      },
      data: { status: 'VOIDED' },
    });

    // 2. Record LoanCancellation
    const cancellation = await tx.loanCancellation.create({
      data: {
        loanId: loan.id,
        cancelledBy: user.id,
        cancelledAt: now,
        reason: data.reason.trim(),
        disbursedPrincipalPaise: totalDisbursedPaise,
        repaidPrincipalPaise: totalPrincipalRepaidPaise,
        netRecoverablePrincipalPaise,
        status: netRecoverablePrincipalPaise === 0 ? 'SETTLED' : 'PENDING_RECOVERY',
      },
    });

    // 3. Mark Loan as CANCELLED
    await tx.loan.update({
      where: { id: loan.id },
      data: { status: 'CANCELLED' },
    });

    // 4. Audit
    await writeAudit({
      actorId: user.id,
      action: 'LOAN_CANCELLED_WITH_RECOVERY',
      entityType: 'LoanCancellation',
      entityId: cancellation.id,
      metadata: {
        loanId: loan.id,
        disbursedPrincipalRupees: paiseToRupees(totalDisbursedPaise),
        repaidPrincipalRupees: paiseToRupees(totalPrincipalRepaidPaise),
        netRecoverablePrincipalRupees: paiseToRupees(netRecoverablePrincipalPaise),
        reason: data.reason,
      },
      tx,
    });
  });

  revalidatePath(`/loans/${loan.id}`);
  revalidatePath('/loans');
  return {
    success: true,
    netRecoverablePrincipalRupees: paiseToRupees(netRecoverablePrincipalPaise),
  };
}
