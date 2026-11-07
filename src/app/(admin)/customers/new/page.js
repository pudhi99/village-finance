import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { getVillagesAndAreas, getLinesList } from '@/features/customers/server-actions';
import CustomerFormClient from './CustomerFormClient';

export const metadata = {
  title: 'New Customer Registration — Village Finance',
};

export default async function NewCustomerPage() {
  const { profile } = await requireAuth();
  requirePermission(profile, 'customers:write');

  const [villages, lines] = await Promise.all([
    getVillagesAndAreas(),
    getLinesList(),
  ]);

  return <CustomerFormClient villages={villages} lines={lines} />;
}
