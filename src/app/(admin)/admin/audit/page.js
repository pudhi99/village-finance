import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { getAuditLogs } from '@/features/auth/server-actions';
import AuditClient from './AuditClient';

export const metadata = {
  title: 'Audit Log — Village Finance',
};

export default async function AuditPage() {
  const { profile } = await requireAuth();
  requirePermission(profile, 'audit:read');

  const logs = await getAuditLogs({ limit: 100 });

  return <AuditClient initialLogs={logs} />;
}
