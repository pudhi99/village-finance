import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { getPartnerDetails } from '@/features/partners/server-actions';
import { serializeDecimals } from '@/lib/serialize';
import PartnerDetailsClient from './PartnerDetailsClient';

export const metadata = {
  title: 'Partner Details | Village Finance',
  description: 'Detailed partner capital ledger, ratio history, withdrawals and profit distributions.',
};

export default async function PartnerDetailsPage({ params }) {
  const { id } = await params;
  const { profile, user } = await requireAuth();

  let partner = null;
  try {
    partner = await getPartnerDetails(id);
  } catch (err) {
    console.error('Error fetching partner details:', err);
  }

  if (!partner) {
    notFound();
  }

  return <PartnerDetailsClient partner={serializeDecimals(partner)} profile={profile} user={user} />;
}
