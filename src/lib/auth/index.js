/**
 * Server-side Authentication & Session Guard — Village Finance
 *
 * Verifies the authenticated Supabase user and resolves their
 * database security profile (roles, permissions, scopes).
 */
import { createClient } from '../supabase/server.js';
import { getUserSecurityProfile, requirePermission, requireScope } from '../permissions/index.js';
import { AuthError } from './errors.js';

export { AuthError, requirePermission, requireScope };

/**
 * Retrieve the authenticated user from Supabase Auth AND
 * load their full verified database security profile.
 *
 * Throws 401 if unauthenticated, 403 if account is disabled/missing.
 *
 * @returns {Promise<{
 *   user: import('@supabase/supabase-js').User,
 *   profile: Awaited<ReturnType<typeof getUserSecurityProfile>>
 * }>}
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Unauthenticated: please sign in', 401);
  }

  const profile = await getUserSecurityProfile(user.id);

  return { user, profile };
}
