import { requireAuth } from '@/lib/auth';
import {
  getCollectionSessionsList,
  getActiveLines,
  getActiveCollectors,
} from '@/features/collections/server-actions';
import CollectionsHubClient from './CollectionsHubClient';

export const metadata = {
  title: 'Field Collection Sessions & GPS | Village Finance',
  description: 'Manage collection lines, field sessions, visit logs, and GPS proximity routing.',
};

export default async function CollectionsPage() {
  const { profile } = await requireAuth();

  const [{ sessions, total }, activeLines, activeCollectors] = await Promise.all([
    getCollectionSessionsList({ limit: 50 }),
    getActiveLines(),
    getActiveCollectors(),
  ]);

  return (
    <CollectionsHubClient
      initialSessions={sessions}
      totalSessions={total}
      lines={activeLines}
      collectors={activeCollectors}
      canManageSessions={profile.isAdmin || profile.permissions.includes('payments:collect')}
      isAdmin={profile.isAdmin}
    />
  );
}
