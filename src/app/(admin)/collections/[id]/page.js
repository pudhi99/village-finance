import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import {
  getCollectionSessionDetails,
  getAssignedCustomersForSession,
} from '@/features/collections/server-actions';
import CollectionSessionClient from './CollectionSessionClient';

export const metadata = {
  title: 'Collection Session Field View | Village Finance',
  description: 'Proximity-sorted field collections, GPS routing, visit logging, and on-site loan repayment.',
};

export default async function CollectionSessionDetailsPage({ params }) {
  const { id } = await params;
  const { profile, user } = await requireAuth();

  let session = null;
  try {
    session = await getCollectionSessionDetails(id);
  } catch (err) {
    notFound();
  }

  if (!session) {
    notFound();
  }

  // Initial customer list without GPS (graceful manual fallback)
  const customerListRes = await getAssignedCustomersForSession({
    sessionId: session.id,
    lineId: session.lineId,
    sessionDate: session.sessionDate,
  });

  return (
    <CollectionSessionClient
      session={session}
      initialCustomers={customerListRes.customers}
      totalAssignedCount={customerListRes.totalAssignedCount}
      currentUser={user}
      userProfile={profile}
    />
  );
}
