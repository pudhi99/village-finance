/**
 * Permissions & Data Scope Engine — Village Finance
 *
 * Implements server-side role resolution, action permission verification,
 * data scope boundaries (Line/Village), and anti-tampering guards.
 */
import prisma from '../prisma.js';
import { AuthError } from '../auth/errors.js';

/**
 * Fetch a user's full security profile from the database:
 * - User status (ACTIVE / DISABLED / INVITED)
 * - Assigned roles
 * - Resolved action permissions
 * - Data scopes (LINE, VILLAGE, ALL)
 *
 * @param {string} userId - Supabase Auth UUID
 * @returns {Promise<{
 *   userId: string,
 *   email: string,
 *   fullName: string,
 *   status: string,
 *   roles: string[],
 *   permissions: string[],
 *   dataScopes: Array<{ scopeType: string, scopeValue: string }>,
 *   isAdmin: boolean
 * }>}
 */
export async function getUserSecurityProfile(userId) {
  if (!userId) {
    throw new AuthError('Unauthenticated: missing user ID', 401);
  }

  const profile = await prisma.userProfile.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
      dataScopes: true,
    },
  });

  if (!profile) {
    throw new AuthError('User profile not found in database', 403);
  }

  if (profile.status === 'DISABLED') {
    throw new AuthError('Account is disabled. Please contact an administrator.', 403);
  }

  const roles = profile.userRoles.map((ur) => ur.role.name);
  const isAdmin = roles.includes('ADMIN');

  // Collect unique permission codes across all assigned roles
  const permissionSet = new Set();
  for (const ur of profile.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissionSet.add(rp.permission.code);
    }
  }

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    status: profile.status,
    roles,
    permissions: Array.from(permissionSet),
    dataScopes: profile.dataScopes.map((ds) => ({
      scopeType: ds.scopeType,
      scopeValue: ds.scopeValue,
    })),
    isAdmin,
  };
}

/**
 * Check if a security profile possesses a specific permission.
 *
 * @param {object} profile - Returned by getUserSecurityProfile()
 * @param {string} permissionCode - e.g. "customers:read"
 * @returns {boolean}
 */
export function hasPermission(profile, permissionCode) {
  if (!profile || profile.status === 'DISABLED') return false;
  if (profile.isAdmin) return true;
  return profile.permissions.includes(permissionCode);
}

/**
 * Enforce permission check on the server. Throws AuthError(403) on failure.
 *
 * @param {object} profile - Returned by getUserSecurityProfile()
 * @param {string} permissionCode - e.g. "loans:approve"
 */
export function requirePermission(profile, permissionCode) {
  if (!hasPermission(profile, permissionCode)) {
    throw new AuthError(
      `Forbidden: missing required permission '${permissionCode}'`,
      403
    );
  }
}

/**
 * Check if a user's data scope permits access to an entity.
 * Admins always have access to all records.
 *
 * @param {object} profile - Security profile
 * @param {'LINE'|'VILLAGE'} scopeType
 * @param {string} scopeValue - Target Line ID or Village ID
 * @returns {boolean}
 */
export function isScopeAllowed(profile, scopeType, scopeValue) {
  if (!profile || profile.status === 'DISABLED') return false;
  if (profile.isAdmin) return true;

  // Check if user has ALL scope
  const hasAllScope = profile.dataScopes.some(
    (ds) => ds.scopeType === 'ALL' || ds.scopeValue === '*'
  );
  if (hasAllScope) return true;

  // Check exact scope match
  return profile.dataScopes.some(
    (ds) => ds.scopeType === scopeType && ds.scopeValue === scopeValue
  );
}

/**
 * Enforce data scope check on the server. Throws AuthError(403) on failure.
 *
 * @param {object} profile
 * @param {'LINE'|'VILLAGE'} scopeType
 * @param {string} scopeValue
 */
export function requireScope(profile, scopeType, scopeValue) {
  if (!isScopeAllowed(profile, scopeType, scopeValue)) {
    throw new AuthError(
      `Forbidden: access outside assigned ${scopeType.toLowerCase()} scope (${scopeValue})`,
      403
    );
  }
}
