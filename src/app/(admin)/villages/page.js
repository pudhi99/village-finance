import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { getVillagesManagementData } from '@/features/customers/server-actions';
import VillagesClient from './VillagesClient';

export const metadata = {
  title: 'Villages, Areas & Collection Lines — Village Finance',
};

export default async function VillagesPage() {
  const { profile } = await requireAuth();
  requirePermission(profile, 'customers:read');

  const { villages, lines } = await getVillagesManagementData();

  return <VillagesClient initialVillages={villages} initialLines={lines} />;
}
