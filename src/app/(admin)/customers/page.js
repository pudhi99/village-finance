import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import {
  getCustomersList,
  getVillagesAndAreas,
  getLinesList,
} from '@/features/customers/server-actions';
import CustomersListClient from './CustomersListClient';

export const metadata = {
  title: 'Customer Directory — Village Finance',
};

export default async function CustomersPage() {
  const { profile } = await requireAuth();
  requirePermission(profile, 'customers:read');

  const [{ customers, totalCount }, villages, lines] = await Promise.all([
    getCustomersList({ limit: 100 }),
    getVillagesAndAreas(),
    getLinesList(),
  ]);

  return (
    <CustomersListClient
      initialCustomers={customers}
      totalCount={totalCount}
      villages={villages}
      lines={lines}
    />
  );
}
