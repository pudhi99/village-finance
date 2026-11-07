import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import {
  getCustomerDetails,
  getVillagesAndAreas,
  getLinesList,
} from '@/features/customers/server-actions';
import CustomerDetailsClient from './CustomerDetailsClient';

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const idStr = resolvedParams?.id ? String(resolvedParams.id).slice(0, 8) : '';
  return {
    title: `Customer Profile #${idStr} — Village Finance`,
  };
}

export default async function CustomerDetailPage({ params }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) {
    notFound();
  }

  const { profile } = await requireAuth();
  requirePermission(profile, 'customers:read');

  let customer = null;
  let villages = [];
  let lines = [];

  try {
    const data = await Promise.all([
      getCustomerDetails(resolvedParams.id),
      getVillagesAndAreas(),
      getLinesList(),
    ]);
    customer = data[0];
    villages = data[1];
    lines = data[2];
  } catch (error) {
    if (error?.message === 'Customer not found') {
      notFound();
    }
    throw error;
  }

  // Deeply serialize to plain JSON so all Date and Prisma objects safely cross RSC boundary
  const safeCustomer = JSON.parse(JSON.stringify(customer));

  return (
    <CustomerDetailsClient
      customer={safeCustomer}
      villages={villages}
      lines={lines}
    />
  );
}
