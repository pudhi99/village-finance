'use server';

/**
 * User & Role Management Server Actions — Village Finance (Module 1)
 * All mutations are server-authorized, anti-tampering protected, and audited.
 */
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { writeAudit } from '@/lib/audit';
import { revokeDevice as revokeDeviceEngine } from '@/lib/auth/device';
import { revalidatePath } from 'next/cache';

/**
 * Fetch all users with their roles, scopes, and devices.
 * Requires: users:read
 */
export async function getUsersList() {
  const { profile } = await requireAuth();
  requirePermission(profile, 'users:read');

  const users = await prisma.userProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      dataScopes: true,
      devices: {
        orderBy: { lastSeenAt: 'desc' },
      },
    },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    roles: u.userRoles.map((ur) => ur.role.name),
    dataScopes: u.dataScopes.map((ds) => ({
      id: ds.id,
      scopeType: ds.scopeType,
      scopeValue: ds.scopeValue,
    })),
    devices: u.devices.map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      status: d.status,
      lastSeenAt: d.lastSeenAt.toISOString(),
      registeredAt: d.registeredAt.toISOString(),
    })),
  }));
}

/**
 * Assign or replace roles for a target user.
 * Prevents self-escalation and accidental admin lockout.
 * Requires: users:manage
 */
export async function updateUserRoles({ targetUserId, roleNames }) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'users:manage');

  // Anti-tampering: prevent self-modification of roles
  if (targetUserId === user.id) {
    throw new Error('Self-escalation prevention: you cannot modify your own roles.');
  }

  const target = await prisma.userProfile.findUnique({
    where: { id: targetUserId },
    include: { userRoles: { include: { role: true } } },
  });

  if (!target) throw new Error('Target user not found.');

  const previousRoles = target.userRoles.map((ur) => ur.role.name);

  // If removing ADMIN from target, ensure at least one other active ADMIN remains
  if (previousRoles.includes('ADMIN') && !roleNames.includes('ADMIN')) {
    const adminCount = await prisma.userRole.count({
      where: {
        role: { name: 'ADMIN' },
        user: { status: 'ACTIVE' },
      },
    });

    if (adminCount <= 1) {
      throw new Error('Safety policy: cannot remove the sole active Administrator.');
    }
  }

  // Fetch target role records
  const rolesToAssign = await prisma.role.findMany({
    where: { name: { in: roleNames } },
  });

  // Execute in transaction: remove old, insert new, audit
  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({
      where: { userId: targetUserId },
    });

    for (const r of rolesToAssign) {
      await tx.userRole.create({
        data: {
          userId: targetUserId,
          roleId: r.id,
          grantedBy: user.id,
        },
      });
    }

    await writeAudit({
      actorId: user.id,
      action: 'ROLE_CHANGED',
      entityType: 'UserProfile',
      entityId: targetUserId,
      metadata: {
        targetEmail: target.email,
        previousRoles,
        newRoles: roleNames,
      },
      tx,
    });
  });

  revalidatePath('/admin/users');
  return { success: true };
}

/**
 * Toggle a user's account status (ACTIVE vs DISABLED).
 * Requires: users:manage
 */
export async function updateUserStatus({ targetUserId, status }) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'users:manage');

  if (targetUserId === user.id) {
    throw new Error('Self-lockout prevention: you cannot disable your own account.');
  }

  const target = await prisma.userProfile.findUnique({
    where: { id: targetUserId },
  });
  if (!target) throw new Error('Target user not found.');

  const updated = await prisma.userProfile.update({
    where: { id: targetUserId },
    data: { status },
  });

  await writeAudit({
    actorId: user.id,
    action: status === 'DISABLED' ? 'USER_DISABLED' : 'USER_ENABLED',
    entityType: 'UserProfile',
    entityId: targetUserId,
    metadata: {
      targetEmail: target.email,
      previousStatus: target.status,
      newStatus: status,
    },
  });

  revalidatePath('/admin/users');
  return { success: true, status: updated.status };
}

/**
 * Assign data scopes to a user (LINE, VILLAGE, ALL).
 * Requires: users:manage
 */
export async function updateUserDataScopes({ targetUserId, scopes }) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'users:manage');

  await prisma.$transaction(async (tx) => {
    await tx.userDataScope.deleteMany({
      where: { userId: targetUserId },
    });

    for (const s of scopes) {
      await tx.userDataScope.create({
        data: {
          userId: targetUserId,
          scopeType: s.scopeType,
          scopeValue: s.scopeValue,
        },
      });
    }

    await writeAudit({
      actorId: user.id,
      action: 'DATA_SCOPE_CHANGED',
      entityType: 'UserProfile',
      entityId: targetUserId,
      metadata: { newScopes: scopes },
      tx,
    });
  });

  revalidatePath('/admin/users');
  return { success: true };
}

/**
 * Revoke a collector device.
 * Requires: devices:revoke or users:manage
 */
export async function revokeUserDevice({ deviceId, reason }) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'devices:revoke');

  await revokeDeviceEngine({
    adminId: user.id,
    deviceId,
    reason,
  });

  revalidatePath('/admin/users');
  return { success: true };
}

/**
 * Fetch system audit logs.
 * Requires: audit:read
 */
export async function getAuditLogs({ limit = 50, entityType, action } = {}) {
  const { profile } = await requireAuth();
  requirePermission(profile, 'audit:read');

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(action ? { action } : {}),
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      actor: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  });

  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    metadata: l.metadata,
    ip: l.ip,
    createdAt: l.createdAt.toISOString(),
    actorEmail: l.actor?.email || 'System / Auto',
    actorName: l.actor?.fullName || 'System',
  }));
}
