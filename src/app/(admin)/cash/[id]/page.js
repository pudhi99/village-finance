import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import {
  getCashBagDetails,
  getCashBagsList,
  getExpenseCategories,
} from '@/features/cash/server-actions';
import CashBagDetailsClient from './CashBagDetailsClient';

export const metadata = {
  title: 'Cash Bag Ledger & Audit | Village Finance',
  description: 'Immutable transaction ledger, opening history, field expenses, and reconciliations for this Cash Bag.',
};

export default async function CashBagDetailsPage({ params }) {
  const { id } = await params;
  const { profile, user } = await requireAuth();

  let details = null;
  try {
    details = await getCashBagDetails(id, { limit: 100 });
  } catch (err) {
    notFound();
  }

  if (!details || !details.bag) {
    notFound();
  }

  const [{ bags }, categories] = await Promise.all([
    getCashBagsList(),
    getExpenseCategories(),
  ]);

  return (
    <CashBagDetailsClient
      bag={details.bag}
      entries={details.entries}
      totalEntries={details.totalEntries}
      allBags={bags}
      categories={categories}
      profile={profile}
      user={user}
    />
  );
}
