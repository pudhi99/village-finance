/**
 * Audit log utility — Village Finance.
 *
 * Every security and financial mutation (payment, disbursement, reversal,
 * role change, user status change, device revocation) must write an audit record.
 */
import prisma from '../prisma.js';

/**
 * Write a structured audit log entry.
 *
 * @param {object} params
 * @param {string|null} [params.actorId]     - Supabase Auth user UUID of actor (null for system events)
 * @param {string} params.action             - e.g. "ROLE_GRANTED", "USER_DISABLED", "DEVICE_REVOKED"
 * @param {string} params.entityType         - e.g. "UserProfile", "UserRole", "DeviceRegistration"
 * @param {string} params.entityId           - ID of the affected entity
 * @param {object} [params.metadata]         - Details (diff, reason, previous state)
 * @param {string|null} [params.ip]          - Request IP address
 * @param {any} [params.tx]                  - Optional Prisma transaction client
 * @returns {Promise<object>} Created AuditLog record
 */
export async function writeAudit({
  actorId = null,
  action,
  entityType,
  entityId,
  metadata = {},
  ip = null,
  tx = null,
}) {
  const db = tx || prisma;
  return db.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      metadata,
      ip,
    },
  });
}
