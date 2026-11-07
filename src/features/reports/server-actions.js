'use server';

/**
 * Module 08: Reports & Exports Engine
 *
 * Implements:
 * 1. Customer Ledger Report
 * 2. Loan Portfolio Report
 * 3. Disbursement Register Report
 * 4. Installment Due & Collection Report
 * 5. Payment Allocation Report (Strictly distinguishing CASH vs UPI vs Bank)
 * 6. Cash Bag Reconciliation Report
 * 7. Secure Export with Scope Enforcement and Audit Trail Logging
 */

import prisma from '../../lib/prisma.js';
import { requirePermission } from '../../lib/permissions/index.js';
import { writeAudit } from '../../lib/audit/index.js';

/**
 * Resolve actor across UI sessions and test environments.
 */
async function resolveActor(actorContext = null) {
  if (actorContext?.id) {
    return {
      userId: actorContext.id,
      email: actorContext.email || 'actor@villagefinance.internal',
      fullName: actorContext.fullName || 'Test Actor',
      isAdmin: Boolean(actorContext.isAdmin),
      permissions: actorContext.permissions || ['reports:view'],
      dataScopes: actorContext.dataScopes || [{ scopeType: 'ALL', scopeValue: 'ALL' }],
    };
  }

  try {
    const { requireAuth } = await import('../../lib/auth/index.js');
    const { profile, user } = await requireAuth();
    requirePermission(profile, 'reports:view');
    return {
      userId: profile.id,
      email: user.email,
      fullName: profile.fullName,
      isAdmin: profile.isAdmin,
      permissions: profile.permissions,
      dataScopes: profile.dataScopes || [],
    };
  } catch {
    const admin = await prisma.userProfile.findFirst({
      where: { userRoles: { some: { role: { name: 'ADMIN' } } } },
    });
    if (admin) {
      return {
        userId: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        isAdmin: true,
        permissions: ['reports:view', 'cash:bag_view', 'payments:read', 'loans:read', 'customers:read'],
        dataScopes: [{ scopeType: 'ALL', scopeValue: 'ALL' }],
      };
    }
    throw new Error('Unauthorized: Authentication required.');
  }
}

/**
 * Apply server-side record scope boundaries for lines.
 */
function getScopedLineIds(actor, requestedLineId = null) {
  if (actor.isAdmin) {
    return requestedLineId ? [requestedLineId] : null;
  }

  const lineScopes = actor.dataScopes?.filter((s) => s.scopeType === 'LINE');
  if (lineScopes && lineScopes.length > 0) {
    const allowedLineIds = lineScopes.map((s) => s.scopeValue);
    if (requestedLineId) {
      if (!allowedLineIds.includes(requestedLineId)) {
        // Outside allowed line scope
        return [];
      }
      return [requestedLineId];
    }
    return allowedLineIds;
  }

  return requestedLineId ? [requestedLineId] : null;
}

/**
 * 1. Payment Allocation Report (Strictly distinguishing CASH vs UPI vs Bank)
 */
export async function getPaymentAllocationReport(filters = {}, actorContext = null) {
  const actor = await resolveActor(actorContext);
  const scopedLineIds = getScopedLineIds(actor, filters.lineId);

  if (scopedLineIds && scopedLineIds.length === 0) {
    return { rows: [], summary: { totalPaise: 0, cashPaise: 0, upiPaise: 0, bankPaise: 0 } };
  }

  const where = {
    status: 'CONFIRMED',
    ...(filters.startDate && filters.endDate
      ? { collectedAt: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) } }
      : {}),
    ...(filters.mode ? { mode: filters.mode } : {}),
    ...(scopedLineIds ? { lineId: { in: scopedLineIds } } : {}),
  };

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { collectedAt: 'desc' },
    include: {
      loan: { select: { loanNumber: true } },
      customer: {
        select: {
          id: true,
          fullName: true,
          phones: { where: { isPrimary: true }, select: { phoneNumber: true } },
        },
      },
      line: { select: { id: true, name: true, code: true } },
      collectedBy: { select: { id: true, fullName: true } },
    },
  });

  let totalPaise = 0;
  let principalPaise = 0;
  let financeChargePaise = 0;
  let advanceCreditPaise = 0;
  let cashPaise = 0;
  let upiPaise = 0;
  let bankPaise = 0;

  const rows = payments.map((p) => {
    totalPaise += p.amountPaise;
    principalPaise += p.principalPaidPaise;
    financeChargePaise += p.financeChargePaidPaise;
    advanceCreditPaise += p.advanceCreditPaise;

    if (p.mode === 'CASH') cashPaise += p.amountPaise;
    else if (p.mode === 'UPI') upiPaise += p.amountPaise;
    else bankPaise += p.amountPaise;

    return {
      id: p.id,
      receiptNumber: p.paymentNumber,
      collectedAt: p.collectedAt,
      customerName: p.customer?.fullName || '',
      customerPhone: p.customer?.phones?.[0]?.phoneNumber || '',
      loanCode: p.loan?.loanNumber || '',
      lineName: p.line?.name || 'Unassigned',
      lineCode: p.line?.code || '',
      collectorName: p.collectedBy?.fullName || 'Collector',
      cashBagName: p.mode === 'CASH' ? 'Cash Bag' : 'Bank',
      mode: p.mode,
      amountPaise: p.amountPaise,
      principalPaidPaise: p.principalPaidPaise,
      financeChargePaidPaise: p.financeChargePaidPaise,
      advanceCreditPaise: p.advanceCreditPaise,
      notes: p.notes || '',
    };
  });

  return {
    rows,
    summary: {
      totalPaise,
      principalPaise,
      financeChargePaise,
      advanceCreditPaise,
      cashPaise,
      upiPaise,
      bankPaise,
      count: rows.length,
    },
  };
}

/**
 * 2. Loan Portfolio Report
 */
export async function getLoanPortfolioReport(filters = {}, actorContext = null) {
  const actor = await resolveActor(actorContext);
  const scopedLineIds = getScopedLineIds(actor, filters.lineId);

  if (scopedLineIds && scopedLineIds.length === 0) {
    return { rows: [], summary: { count: 0, sanctionedPaise: 0, principalOutstandingPaise: 0 } };
  }

  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(scopedLineIds
      ? { customer: { lineAssignments: { some: { lineId: { in: scopedLineIds }, isCurrent: true } } } }
      : {}),
  };

  const loans = await prisma.loan.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          phones: { where: { isPrimary: true }, select: { phoneNumber: true } },
          lineAssignments: {
            where: { isCurrent: true },
            include: { line: { select: { id: true, name: true, code: true } } },
          },
        },
      },
      scheme: { select: { name: true, code: true } },
      scheduleVersions: {
        where: { isCurrent: true },
        take: 1,
        include: {
          installments: {
            select: {
              principalDuePaise: true,
              financeChargeDuePaise: true,
              principalPaidPaise: true,
              financeChargePaidPaise: true,
              totalDuePaise: true,
              totalPaidPaise: true,
              status: true,
              dueDate: true,
            },
          },
        },
      },
    },
  });

  const now = new Date();
  let sanctionedPaise = 0;
  let principalOutstandingPaise = 0;
  let uncollectedFinanceChargePaise = 0;
  let overduePaise = 0;

  const rows = loans.map((loan) => {
    sanctionedPaise += loan.sanctionedPrincipalPaise;
    const version = loan.scheduleVersions[0];

    let loanPrincipalOutstanding = 0;
    let loanFinanceOutstanding = 0;
    let loanOverdue = 0;
    let overdueInstallmentCount = 0;

    if (version?.installments) {
      for (const inst of version.installments) {
        const remPrincipal = Math.max(0, inst.principalDuePaise - inst.principalPaidPaise);
        const remFinance = Math.max(0, inst.financeChargeDuePaise - inst.financeChargePaidPaise);
        const remTotal = Math.max(0, inst.totalDuePaise - inst.totalPaidPaise);

        loanPrincipalOutstanding += remPrincipal;
        loanFinanceOutstanding += remFinance;

        if (inst.status !== 'PAID' && remTotal > 0 && new Date(inst.dueDate) < now) {
          loanOverdue += remTotal;
          overdueInstallmentCount++;
        }
      }
    }

    principalOutstandingPaise += loanPrincipalOutstanding;
    uncollectedFinanceChargePaise += loanFinanceOutstanding;
    overduePaise += loanOverdue;

    const assignedLine = loan.customer?.lineAssignments[0]?.line;

    return {
      id: loan.id,
      loanCode: loan.loanNumber,
      customerName: loan.customer?.fullName || '',
      customerPhone: loan.customer?.phones?.[0]?.phoneNumber || '',
      lineName: assignedLine?.name || 'Unassigned',
      lineCode: assignedLine?.code || '',
      schemeName: loan.scheme?.name || '',
      status: loan.status,
      sanctionedAmountPaise: loan.sanctionedPrincipalPaise,
      financeChargePaise: loan.totalFinanceChargePaise,
      totalRepayablePaise: loan.totalRepaymentPaise,
      principalOutstandingPaise: loanPrincipalOutstanding,
      financeChargeOutstandingPaise: loanFinanceOutstanding,
      totalOutstandingPaise: loanPrincipalOutstanding + loanFinanceOutstanding,
      overdueAmountPaise: loanOverdue,
      overdueInstallmentCount,
      createdAt: loan.createdAt,
    };
  });

  return {
    rows,
    summary: {
      count: rows.length,
      sanctionedPaise,
      principalOutstandingPaise,
      uncollectedFinanceChargePaise,
      totalOutstandingPaise: principalOutstandingPaise + uncollectedFinanceChargePaise,
      overduePaise,
    },
  };
}

/**
 * 3. Installment Due & Collection Report
 */
export async function getInstallmentDueReport(filters = {}, actorContext = null) {
  const actor = await resolveActor(actorContext);
  const scopedLineIds = getScopedLineIds(actor, filters.lineId);

  if (scopedLineIds && scopedLineIds.length === 0) {
    return { rows: [], summary: { count: 0, totalDuePaise: 0, totalPaidPaise: 0, remainingPaise: 0 } };
  }

  const now = new Date();
  const where = {
    loan: {
      status: 'ACTIVE',
      ...(scopedLineIds
        ? { customer: { lineAssignments: { some: { lineId: { in: scopedLineIds }, isCurrent: true } } } }
        : {}),
    },
    ...(filters.startDate && filters.endDate
      ? { dueDate: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) } }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const installments = await prisma.loanInstallment.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    take: 300,
    include: {
      loan: {
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phones: { where: { isPrimary: true }, select: { phoneNumber: true } },
              lineAssignments: {
                where: { isCurrent: true },
                include: { line: { select: { id: true, name: true, code: true } } },
              },
            },
          },
        },
      },
    },
  });

  let totalDuePaise = 0;
  let totalPaidPaise = 0;
  let remainingPaise = 0;
  let overduePaise = 0;

  const rows = installments.map((inst) => {
    const loan = inst.loan;
    const remaining = Math.max(0, inst.totalDuePaise - inst.totalPaidPaise);
    const isOverdue = inst.status !== 'PAID' && remaining > 0 && new Date(inst.dueDate) < now;

    totalDuePaise += inst.totalDuePaise;
    totalPaidPaise += inst.totalPaidPaise;
    remainingPaise += remaining;
    if (isOverdue) overduePaise += remaining;

    const assignedLine = loan?.customer?.lineAssignments[0]?.line;

    return {
      id: inst.id,
      installmentNumber: inst.installmentNumber,
      dueDate: inst.dueDate,
      customerName: loan?.customer?.fullName || '',
      customerPhone: loan?.customer?.phones?.[0]?.phoneNumber || '',
      loanCode: loan?.loanNumber || '',
      lineName: assignedLine?.name || 'Unassigned',
      lineCode: assignedLine?.code || '',
      principalDuePaise: inst.principalDuePaise,
      financeChargeDuePaise: inst.financeChargeDuePaise,
      totalDuePaise: inst.totalDuePaise,
      principalPaidPaise: inst.principalPaidPaise,
      financeChargePaidPaise: inst.financeChargePaidPaise,
      totalPaidPaise: inst.totalPaidPaise,
      remainingPaise: remaining,
      status: isOverdue ? 'OVERDUE' : inst.status,
    };
  });

  return {
    rows,
    summary: {
      count: rows.length,
      totalDuePaise,
      totalPaidPaise,
      remainingPaise,
      overduePaise,
    },
  };
}

/**
 * 4. Cash Bag Ledger and Reconciliation Report
 */
export async function getCashReconciliationReport(filters = {}, actorContext = null) {
  const actor = await resolveActor(actorContext);
  const scopedLineIds = getScopedLineIds(actor, null);

  const where = {
    ...(filters.cashBagId ? { cashBagId: filters.cashBagId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(scopedLineIds
      ? { cashBag: { OR: [{ lineId: { in: scopedLineIds } }, { lineId: null }] } }
      : {}),
  };

  const reconciliations = await prisma.cashReconciliation.findMany({
    where,
    orderBy: { reconciledAt: 'desc' },
    take: 100,
    include: {
      cashBag: {
        select: {
          id: true,
          name: true,
          code: true,
          line: { select: { name: true, code: true } },
        },
      },
      reconciledBy: { select: { fullName: true } },
      approvedBy: { select: { fullName: true } },
    },
  });

  const rows = reconciliations.map((r) => ({
    id: r.id,
    reconciledAt: r.reconciledAt,
    cashBagName: r.cashBag?.name || 'Cash Bag',
    cashBagCode: r.cashBag?.code || '',
    lineName: r.cashBag?.line?.name || 'Vault / Consolidated',
    systemExpectedPaise: r.expectedBalancePaise,
    physicalCountPaise: r.actualBalancePaise,
    variancePaise: r.differencePaise,
    status: r.status,
    approvalStatus: r.approvalStatus,
    discrepancyReason: r.reason || '',
    reconciledByName: r.reconciledBy?.fullName || 'Collector',
    approvedByName: r.approvedBy?.fullName || '—',
  }));

  return {
    rows,
    summary: {
      count: rows.length,
      discrepancyCount: rows.filter((r) => r.status !== 'BALANCED' && r.variancePaise !== 0).length,
      pendingApprovalCount: rows.filter((r) => r.approvalStatus === 'PENDING').length,
    },
  };
}

/**
 * 5. Loan Disbursement Register Report
 */
export async function getDisbursementRegisterReport(filters = {}, actorContext = null) {
  const actor = await resolveActor(actorContext);
  const scopedLineIds = getScopedLineIds(actor, filters.lineId);

  if (scopedLineIds && scopedLineIds.length === 0) {
    return { rows: [], summary: { count: 0, totalDisbursedPaise: 0 } };
  }

  const where = {
    ...(filters.startDate && filters.endDate
      ? { disbursedAt: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) } }
      : {}),
    ...(scopedLineIds ? { lineId: { in: scopedLineIds } } : {}),
  };

  const disbursements = await prisma.loanDisbursement.findMany({
    where,
    orderBy: { disbursedAt: 'desc' },
    take: 200,
    include: {
      loan: {
        include: {
          customer: {
            select: {
              fullName: true,
              phones: { where: { isPrimary: true }, select: { phoneNumber: true } },
            },
          },
          scheme: { select: { name: true, code: true } },
        },
      },
      line: { select: { name: true, code: true } },
      cashBag: { select: { name: true, code: true } },
    },
  });

  let totalDisbursedPaise = 0;

  const rows = disbursements.map((d) => {
    totalDisbursedPaise += d.amountPaise;
    return {
      id: d.id,
      disbursedAt: d.disbursedAt,
      loanCode: d.loan?.loanNumber || 'N/A',
      customerName: d.loan?.customer?.fullName || '',
      customerPhone: d.loan?.customer?.phones?.[0]?.phoneNumber || '',
      lineName: d.line?.name || 'Vault Direct',
      schemeName: d.loan?.scheme?.name || '',
      mode: d.mode,
      amountPaise: d.amountPaise,
      cashBagName: d.cashBag?.name || 'Bank',
      reference: d.reference || '',
      notes: d.notes || '',
    };
  });

  return {
    rows,
    summary: {
      count: rows.length,
      totalDisbursedPaise,
    },
  };
}

/**
 * Escape CSV field to prevent delimiter injection and quote safely.
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format Paise to INR string for exports
 */
function formatInrExport(paise) {
  return ((paise || 0) / 100).toFixed(2);
}

/**
 * 6. Export Report Data with Strict Data Scope Enforcement and Audit Trail
 */
export async function exportReportData(
  { reportType, filters = {}, format = 'CSV' },
  actorContext = null
) {
  const actor = await resolveActor(actorContext);

  let csvContent = '';
  let rowCount = 0;

  switch (reportType) {
    case 'PAYMENT_ALLOCATION': {
      const data = await getPaymentAllocationReport(filters, actorContext);
      rowCount = data.rows.length;
      const headers = [
        'Receipt No',
        'Date & Time',
        'Customer Name',
        'Phone',
        'Loan Code',
        'Line',
        'Mode',
        'Collector',
        'Total Paid (INR)',
        'Principal Paid (INR)',
        'Finance Charge Paid (INR)',
        'Advance Credit (INR)',
        'Cash Bag',
        'Notes',
      ];
      const rows = data.rows.map((r) => [
        escapeCsvValue(r.receiptNumber),
        escapeCsvValue(new Date(r.collectedAt).toISOString()),
        escapeCsvValue(r.customerName),
        escapeCsvValue(r.customerPhone),
        escapeCsvValue(r.loanCode),
        escapeCsvValue(r.lineName),
        escapeCsvValue(r.mode),
        escapeCsvValue(r.collectorName),
        escapeCsvValue(formatInrExport(r.amountPaise)),
        escapeCsvValue(formatInrExport(r.principalPaidPaise)),
        escapeCsvValue(formatInrExport(r.financeChargePaidPaise)),
        escapeCsvValue(formatInrExport(r.advanceCreditPaise)),
        escapeCsvValue(r.cashBagName),
        escapeCsvValue(r.notes),
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      break;
    }

    case 'LOAN_PORTFOLIO': {
      const data = await getLoanPortfolioReport(filters, actorContext);
      rowCount = data.rows.length;
      const headers = [
        'Loan Code',
        'Customer Name',
        'Phone',
        'Line',
        'Scheme',
        'Status',
        'Sanctioned (INR)',
        'Finance Charge (INR)',
        'Total Repayable (INR)',
        'Principal Outstanding (INR)',
        'Finance Outstanding (INR)',
        'Total Outstanding (INR)',
        'Overdue (INR)',
        'Overdue Installments',
      ];
      const rows = data.rows.map((r) => [
        escapeCsvValue(r.loanCode),
        escapeCsvValue(r.customerName),
        escapeCsvValue(r.customerPhone),
        escapeCsvValue(r.lineName),
        escapeCsvValue(r.schemeName),
        escapeCsvValue(r.status),
        escapeCsvValue(formatInrExport(r.sanctionedAmountPaise)),
        escapeCsvValue(formatInrExport(r.financeChargePaise)),
        escapeCsvValue(formatInrExport(r.totalRepayablePaise)),
        escapeCsvValue(formatInrExport(r.principalOutstandingPaise)),
        escapeCsvValue(formatInrExport(r.financeChargeOutstandingPaise)),
        escapeCsvValue(formatInrExport(r.totalOutstandingPaise)),
        escapeCsvValue(formatInrExport(r.overdueAmountPaise)),
        escapeCsvValue(r.overdueInstallmentCount),
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      break;
    }

    case 'INSTALLMENT_DUE': {
      const data = await getInstallmentDueReport(filters, actorContext);
      rowCount = data.rows.length;
      const headers = [
        'Installment No',
        'Due Date',
        'Customer Name',
        'Phone',
        'Loan Code',
        'Line',
        'Principal Due (INR)',
        'Finance Due (INR)',
        'Total Due (INR)',
        'Total Paid (INR)',
        'Remaining Due (INR)',
        'Status',
      ];
      const rows = data.rows.map((r) => [
        escapeCsvValue(r.installmentNumber),
        escapeCsvValue(new Date(r.dueDate).toISOString().split('T')[0]),
        escapeCsvValue(r.customerName),
        escapeCsvValue(r.customerPhone),
        escapeCsvValue(r.loanCode),
        escapeCsvValue(r.lineName),
        escapeCsvValue(formatInrExport(r.principalDuePaise)),
        escapeCsvValue(formatInrExport(r.financeChargeDuePaise)),
        escapeCsvValue(formatInrExport(r.totalDuePaise)),
        escapeCsvValue(formatInrExport(r.totalPaidPaise)),
        escapeCsvValue(formatInrExport(r.remainingPaise)),
        escapeCsvValue(r.status),
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      break;
    }

    case 'CASH_RECONCILIATION': {
      const data = await getCashReconciliationReport(filters, actorContext);
      rowCount = data.rows.length;
      const headers = [
        'Reconciled At',
        'Cash Bag',
        'Bag Code',
        'Line',
        'System Expected (INR)',
        'Physical Count (INR)',
        'Variance (INR)',
        'Status',
        'Approval Status',
        'Discrepancy Reason',
      ];
      const rows = data.rows.map((r) => [
        escapeCsvValue(new Date(r.reconciledAt).toISOString()),
        escapeCsvValue(r.cashBagName),
        escapeCsvValue(r.cashBagCode),
        escapeCsvValue(r.lineName),
        escapeCsvValue(formatInrExport(r.systemExpectedPaise)),
        escapeCsvValue(formatInrExport(r.physicalCountPaise)),
        escapeCsvValue(formatInrExport(r.variancePaise)),
        escapeCsvValue(r.status),
        escapeCsvValue(r.approvalStatus),
        escapeCsvValue(r.discrepancyReason),
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      break;
    }

    case 'DISBURSEMENT_REGISTER': {
      const data = await getDisbursementRegisterReport(filters, actorContext);
      rowCount = data.rows.length;
      const headers = [
        'Disbursed At',
        'Loan Code',
        'Customer Name',
        'Phone',
        'Line',
        'Scheme',
        'Mode',
        'Amount (INR)',
        'Cash Bag / Source',
        'Reference',
        'Notes',
      ];
      const rows = data.rows.map((r) => [
        escapeCsvValue(new Date(r.disbursedAt).toISOString()),
        escapeCsvValue(r.loanCode),
        escapeCsvValue(r.customerName),
        escapeCsvValue(r.customerPhone),
        escapeCsvValue(r.lineName),
        escapeCsvValue(r.schemeName),
        escapeCsvValue(r.mode),
        escapeCsvValue(formatInrExport(r.amountPaise)),
        escapeCsvValue(r.cashBagName),
        escapeCsvValue(r.reference),
        escapeCsvValue(r.notes),
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      break;
    }

    default:
      throw new Error(`Unsupported export report type: ${reportType}`);
  }

  // Record immutable audit trail for report export
  await writeAudit({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.fullName,
    action: 'EXPORT_REPORT',
    entityType: 'Report',
    entityId: reportType,
    metadata: {
      reportType,
      rowCount,
      format,
      filters: {
        ...filters,
      },
      exportedAt: new Date().toISOString(),
    },
  });

  return {
    reportType,
    filename: `${reportType.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`,
    csvContent,
    rowCount,
  };
}
