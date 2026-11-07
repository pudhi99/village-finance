import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { getUsersList } from '@/features/auth/server-actions';
import UsersClient from './UsersClient';

export const metadata = {
  title: 'User & Role Management — Village Finance',
};

export default async function UsersPage() {
  const { user, profile } = await requireAuth();
  requirePermission(profile, 'users:read');

  const users = await getUsersList();

  return <UsersClient initialUsers={users} currentUserId={user.id} />;
}
