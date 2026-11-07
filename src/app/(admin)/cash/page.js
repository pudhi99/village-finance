import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  getCashBagsList,
  getExpenseCategories,
  getOrCreateLineCashBag,
  getOrCreateVaultCashBag,
} from '@/features/cash/server-actions';
import CashHubClient from './CashHubClient';

export const metadata = {
  title: 'Cash Bags & Cash Ledger | Village Finance',
  description: 'Manage Line cash bags, daily openings, immutable ledger entries, inter-line transfers, expenses, and reconciliations.',
};

export default async function CashManagementPage() {
  const { profile, user } = await requireAuth();

  // Ensure all current lines and the vault have a dedicated CashBag
  const lines = await prisma.line.findMany({ select: { id: true } });
  await Promise.all([
    ...lines.map((l) => getOrCreateLineCashBag(l.id)),
    getOrCreateVaultCashBag(),
  ]);

  const [{ bags, totalVaultPaise, totalVaultRupees }, categories] = await Promise.all([
    getCashBagsList(),
    getExpenseCategories(),
  ]);

  return (
    <CashHubClient
      initialBags={bags}
      totalVaultRupees={totalVaultRupees}
      categories={categories}
      profile={profile}
      user={user}
    />
  );
}
