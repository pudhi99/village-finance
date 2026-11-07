import { requireAuth } from '@/lib/auth';
import { getDashboardMetrics } from '@/features/dashboard/server-actions';
import DashboardClient from './DashboardClient';

export const metadata = {
  title: 'Dashboard — Village Finance',
  description: 'Authoritative portfolio receivables, cash bag ledger balances, and line collections.',
};

export default async function DashboardPage() {
  const { user, profile } = await requireAuth();

  // Load authoritative metrics from live PostgreSQL
  const metrics = await getDashboardMetrics();

  return (
    <DashboardClient
      initialMetrics={metrics}
      profile={profile}
      user={user}
    />
  );
}
