import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import prisma from '@/lib/prisma';
import { getLoanSchemes } from '@/features/loans/server-actions';
import LoanApplicationFormClient from './LoanApplicationFormClient';

export const metadata = {
  title: 'Apply for Loan — Village Finance',
};

export default async function NewLoanPage() {
  const { profile } = await requireAuth();
  requirePermission(profile, 'loans:apply');

  // Fetch customers with their existing loans to check active overlapping status
  const [customers, schemes] = await Promise.all([
    prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        customerNumber: true,
        fullName: true,
        village: { select: { name: true } },
        loans: {
          where: {
            status: { in: ['SUBMITTED', 'APPROVED', 'PARTIALLY_DISBURSED', 'DISBURSED', 'ACTIVE'] },
          },
          select: { id: true },
        },
      },
    }),
    getLoanSchemes(),
  ]);

  const customerList = customers.map((c) => ({
    id: c.id,
    customerNumber: c.customerNumber,
    fullName: c.fullName,
    villageName: c.village.name,
    hasActiveLoan: c.loans.length > 0,
  }));

  return <LoanApplicationFormClient customers={customerList} schemes={schemes} />;
}
