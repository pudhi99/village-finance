import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { getLoansList, getLoanSchemes } from '@/features/loans/server-actions';
import LoansListClient from './LoansListClient';

export const metadata = {
  title: 'Loan Accounts & Schemes — Village Finance',
};

export default async function LoansPage() {
  const { profile } = await requireAuth();
  requirePermission(profile, 'loans:read');

  const [{ loans, totalCount }, schemes] = await Promise.all([
    getLoansList({ limit: 100 }),
    getLoanSchemes(),
  ]);

  return (
    <LoansListClient
      initialLoans={loans}
      totalCount={totalCount}
      schemes={schemes}
      userProfile={profile}
    />
  );
}
