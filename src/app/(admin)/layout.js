import { requireAuth } from '@/lib/auth';
import AppShell from '@/components/layout/AppShell';

export default async function AdminLayout({ children }) {
  const { user, profile } = await requireAuth();

  return (
    <AppShell user={user} profile={profile}>
      {children}
    </AppShell>
  );
}
