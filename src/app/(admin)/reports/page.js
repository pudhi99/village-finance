import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import prisma from '@/lib/prisma';
import { getPaymentAllocationReport } from '@/features/reports/server-actions';
import ReportsClient from './ReportsClient';

export const metadata = {
  title: 'Reports & P&L — Village Finance',
  description: 'Financial allocations, loan portfolios, due installments, cash reconciliations, and exports.',
};

export default async function ReportsPage() {
  const { profile } = await requireAuth();
  requirePermission(profile, 'reports:view');

  // Determine line scope for dropdown
  let lineWhere = {};
  if (!profile.isAdmin) {
    const lineScopes = profile.dataScopes?.filter((s) => s.scopeType === 'LINE');
    if (lineScopes && lineScopes.length > 0) {
      lineWhere = { id: { in: lineScopes.map((s) => s.scopeValue) } };
    }
  }

  const [lines, initialAllocationReport] = await Promise.all([
    prisma.line.findMany({
      where: lineWhere,
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    getPaymentAllocationReport({}, { id: profile.id, isAdmin: profile.isAdmin, dataScopes: profile.dataScopes }),
  ]);

  return (
    <ReportsClient
      lines={lines}
      initialAllocationReport={initialAllocationReport}
      profile={profile}
    />
  );
}
