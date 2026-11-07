import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getPartnersList, getProfitPeriodsList } from '@/features/partners/server-actions';
import { serializeDecimals } from '@/lib/serialize';
import PartnersHubClient from './PartnersHubClient';

export const metadata = {
  title: 'Partner Capital & Profit/Loss | Village Finance',
  description: 'Manage partner capital contributions, effective-dated ratios, withdrawals, profit periods, and distributions.',
};

export default async function PartnersPage() {
  const { profile, user } = await requireAuth();

  const [partners, profitPeriods, cashBags, candidateUsers] = await Promise.all([
    getPartnersList(),
    getProfitPeriodsList(),
    prisma.cashBag.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.userProfile.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  return (
    <PartnersHubClient
      initialPartners={serializeDecimals(partners)}
      initialPeriods={serializeDecimals(profitPeriods)}
      cashBags={cashBags}
      candidateUsers={candidateUsers}
      profile={profile}
      user={user}
    />
  );
}
