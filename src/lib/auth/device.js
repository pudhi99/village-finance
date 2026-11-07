/**
 * Device Registration & Revocation Engine — Village Finance
 *
 * Implements:
 * - Auto-registration of new collector devices as ACTIVE
 * - Verification of device status on protected sessions
 * - Instant revocation by Admin with audit log
 */
import prisma from '@/lib/prisma';
import { AuthError } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

/**
 * Check device status or auto-register if new.
 * Throws AuthError(403) if device is REVOKED.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.deviceFingerprint - Browser / hardware client identifier
 * @param {string} [params.deviceName]       - Optional label (e.g. "Collector Redmi Note")
 * @returns {Promise<object>} DeviceRegistration record
 */
export async function verifyOrRegisterDevice({
  userId,
  deviceFingerprint,
  deviceName = 'Unknown Device',
}) {
  if (!userId || !deviceFingerprint) {
    throw new AuthError('Missing device registration parameters', 400);
  }

  const existingDevice = await prisma.deviceRegistration.findUnique({
    where: {
      userId_deviceFingerprint: {
        userId,
        deviceFingerprint,
      },
    },
  });

  if (existingDevice) {
    if (existingDevice.status === 'REVOKED') {
      throw new AuthError(
        'This device has been revoked by an administrator. Field collection is disabled on this device.',
        403
      );
    }

    // Update lastSeenAt
    return prisma.deviceRegistration.update({
      where: { id: existingDevice.id },
      data: { lastSeenAt: new Date() },
    });
  }

  // Auto-register new device as ACTIVE
  const newDevice = await prisma.deviceRegistration.create({
    data: {
      userId,
      deviceFingerprint,
      deviceName,
      status: 'ACTIVE',
      lastSeenAt: new Date(),
    },
  });

  await writeAudit({
    actorId: userId,
    action: 'DEVICE_REGISTERED',
    entityType: 'DeviceRegistration',
    entityId: newDevice.id,
    metadata: {
      deviceFingerprint,
      deviceName,
      status: 'ACTIVE',
    },
  });

  return newDevice;
}

/**
 * Revoke a device registration. Admin only.
 *
 * @param {object} params
 * @param {string} params.adminId  - Admin actor UUID
 * @param {string} params.deviceId - Target device registration ID
 * @param {string} [params.reason] - Revocation reason (e.g. "Device reported lost")
 */
export async function revokeDevice({ adminId, deviceId, reason = 'Administrative revocation' }) {
  const device = await prisma.deviceRegistration.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new AuthError('Device not found', 404);
  }

  const updated = await prisma.deviceRegistration.update({
    where: { id: deviceId },
    data: { status: 'REVOKED' },
  });

  await writeAudit({
    actorId: adminId,
    action: 'DEVICE_REVOKED',
    entityType: 'DeviceRegistration',
    entityId: device.id,
    metadata: {
      targetUserId: device.userId,
      deviceFingerprint: device.deviceFingerprint,
      reason,
    },
  });

  return updated;
}
