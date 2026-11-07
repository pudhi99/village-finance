import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { getLoanDetails } from '@/features/loans/server-actions';
import { getLinesList } from '@/features/customers/server-actions';
import LoanDetailsClient from './LoanDetailsClient';

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  return {
    title: `Loan Account #${resolvedParams.id.slice(0, 8)} — Village Finance`,
  };
}

export default async function LoanDetailPage({ params }) {
  const resolvedParams = await params;
  const { profile } = await requireAuth();
  requirePermission(profile, 'loans:read');

  let loan = null;
  let lines = [];

  try {
    const data = await Promise.all([
      getLoanDetails(resolvedParams.id),
      getLinesList(),
    ]);
    loan = data[0];
    lines = data[1];
  } catch (error) {
    if (error.message === 'Loan not found') {
      notFound();
    }
    throw error;
  }

  return <LoanDetailsClient loan={loan} userProfile={profile} lines={lines} />;
}
