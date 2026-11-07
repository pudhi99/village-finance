import { requireAuth } from '@/lib/auth';
import { getPaymentsList } from '@/features/payments/server-actions';
import prisma from '@/lib/prisma';
import PaymentsListClient from './PaymentsListClient';
import { paiseToRupees } from '@/lib/money';

export const metadata = {
  title: 'Payments & Allocations | Village Finance',
  description: 'Manage repayments, FIFO installment allocations, advance credits, and payment reversals.',
};

export default async function PaymentsPage() {
  const { profile } = await requireAuth();

  // Fetch initial list of payments
  const { payments, total } = await getPaymentsList({ limit: 50 });

  // Fetch active loans eligible for repayments
  const eligibleLoans = await prisma.loan.findMany({
    where: {
      status: { in: ['ACTIVE', 'DISBURSED', 'PARTIALLY_DISBURSED'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      customer: {
        select: {
          id: true,
          customerNumber: true,
          fullName: true,
          village: { select: { name: true } },
          lineAssignments: {
            where: { isCurrent: true },
            select: { lineId: true, line: { select: { name: true, code: true } } },
          },
        },
      },
      scheme: {
        select: { name: true, code: true, frequency: true },
      },
      installments: {
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        orderBy: { installmentNumber: 'asc' },
        select: {
          id: true,
          installmentNumber: true,
          dueDate: true,
          totalDuePaise: true,
          totalPaidPaise: true,
          principalDuePaise: true,
          principalPaidPaise: true,
          financeChargeDuePaise: true,
          financeChargePaidPaise: true,
        },
      },
    },
  });

  const formattedEligibleLoans = eligibleLoans.map((l) => {
    const totalPendingPaise = l.installments.reduce(
      (sum, i) => sum + (i.totalDuePaise - i.totalPaidPaise),
      0
    );
    const nextInstallment = l.installments[0] || null;

    return {
      id: l.id,
      loanNumber: l.loanNumber,
      status: l.status,
      customerName: l.customer.fullName,
      customerNumber: l.customer.customerNumber,
      villageName: l.customer.village?.name || 'N/A',
      schemeName: l.scheme.name,
      schemeCode: l.scheme.code,
      lineId: l.customer.lineAssignments?.[0]?.lineId || null,
      lineName: l.customer.lineAssignments?.[0]?.line?.name || null,
      totalPendingRupees: paiseToRupees(totalPendingPaise),
      nextInstallmentDueRupees: nextInstallment
        ? paiseToRupees(nextInstallment.totalDuePaise - nextInstallment.totalPaidPaise)
        : 0,
      nextInstallmentNumber: nextInstallment ? nextInstallment.installmentNumber : null,
      nextDueDate: nextInstallment ? nextInstallment.dueDate.toISOString() : null,
      installments: l.installments.map((inst) => ({
        id: inst.id,
        installmentNumber: inst.installmentNumber,
        dueDate: inst.dueDate.toISOString(),
        totalDueRupees: paiseToRupees(inst.totalDuePaise),
        totalPaidRupees: paiseToRupees(inst.totalPaidPaise),
        balanceDueRupees: paiseToRupees(inst.totalDuePaise - inst.totalPaidPaise),
        principalDueRupees: paiseToRupees(inst.principalDuePaise),
        principalPaidRupees: paiseToRupees(inst.principalPaidPaise),
        remainingPrincipalRupees: paiseToRupees(inst.principalDuePaise - inst.principalPaidPaise),
        financeChargeDueRupees: paiseToRupees(inst.financeChargeDuePaise),
        financeChargePaidRupees: paiseToRupees(inst.financeChargePaidPaise),
        remainingFCRupees: paiseToRupees(inst.financeChargeDuePaise - inst.financeChargePaidPaise),
      })),
    };
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PaymentsListClient
        initialPayments={payments}
        initialTotal={total}
        eligibleLoans={formattedEligibleLoans}
        profile={profile}
      />
    </div>
  );
}
