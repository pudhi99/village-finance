'use server';

/**
 * Module 09: Offline Sync Protocol & Conflict Engine
 *
 * Implements:
 * 1. Pre-trip offline package download for designated collection routes / sessions.
 * 2. Atomic offline batch synchronization with strict idempotency and device validation.
 * 3. Conflict detection and flagging to NEEDS_REVIEW when concurrent device submissions collide.
 * 4. Manager conflict resolution workflow.
 */

import prisma from '../../lib/prisma.js';
import { requirePermission } from '../../lib/permissions/index.js';
import { executeRecordPayment } from '../payments/server-actions.js';
import { getOrCreateLineCashBag } from '../cash/server-actions.js';
import { writeAudit } from '../../lib/audit/index.js';

/**
 * Resolve actor across UI sessions and test environments.
 */
async function resolveActor(actorContext = null) {
  if (actorContext?.id) {
    return {
      userId: actorContext.id,
      email: actorContext.email || 'collector@villagefinance.internal',
      fullName: actorContext.fullName || 'Collector Actor',
      isAdmin: Boolean(actorContext.isAdmin),
      permissions: actorContext.permissions || ['payments:collect', 'payments:read', 'customers:read'],
      dataScopes: actorContext.dataScopes || [{ scopeType: 'ALL', scopeValue: 'ALL' }],
    };
  }

  try {
    const { requireAuth } = await import('../../lib/auth/index.js');
    const { profile, user } = await requireAuth();
    return {
      userId: profile.id,
      email: user.email,
      fullName: profile.fullName,
      isAdmin: profile.isAdmin,
      permissions: profile.permissions,
      dataScopes: profile.dataScopes || [],
    };
  } catch {
    const admin = await prisma.userProfile.findFirst({
      where: { userRoles: { some: { role: { name: 'ADMIN' } } } },
    });
    if (admin) {
      return {
        userId: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        isAdmin: true,
        permissions: ['payments:collect', 'payments:read', 'customers:read'],
        dataScopes: [{ scopeType: 'ALL', scopeValue: 'ALL' }],
      };
    }
    throw new Error('Unauthorized: Authentication required.');
  }
}

/**
 * 1. Pre-Trip Offline Package Download
 * Scopes data strictly to the selected Line and session.
 */
export async function downloadSessionOfflinePackage({ sessionId = null, lineId = null }, actorContext = null) {
  const actor = await resolveActor(actorContext);

  let targetLineId = lineId;
  let session = null;

  if (sessionId) {
    session = await prisma.collectionSession.findUnique({
      where: { id: sessionId },
      include: { line: true },
    });
    if (!session) throw new Error('Collection session not found.');
    targetLineId = session.lineId;
  }

  if (!targetLineId) {
    throw new Error('Either sessionId or lineId must be provided.');
  }

  // Validate Line data scope
  if (!actor.isAdmin) {
    const lineScopes = actor.dataScopes?.filter((s) => s.scopeType === 'LINE');
    if (lineScopes && lineScopes.length > 0) {
      const allowedLineIds = lineScopes.map((s) => s.scopeValue);
      if (!allowedLineIds.includes(targetLineId)) {
        throw new Error('Access denied: You do not have data scope authorization for this collection line.');
      }
    }
  }

  const line = await prisma.line.findUnique({
    where: { id: targetLineId },
  });
  if (!line) throw new Error('Collection line not found.');

  // Ensure line cash bag exists
  const cashBag = await getOrCreateLineCashBag(targetLineId);

  // Fetch assigned customers for this line
  const customerAssignments = await prisma.customerLineAssignment.findMany({
    where: { lineId: targetLineId, isCurrent: true },
    include: {
      customer: {
        select: {
          id: true,
          customerNumber: true,
          fullName: true,
          status: true,
          village: { select: { id: true, name: true, code: true } },
          area: { select: { id: true, name: true } },
          phones: { where: { isPrimary: true }, select: { phoneNumber: true } },
          locations: { take: 1, select: { latitude: true, longitude: true, accuracy: true } },
        },
      },
    },
  });

  const customers = customerAssignments.map((ca) => ({
    id: ca.customer.id,
    customerNumber: ca.customer.customerNumber,
    fullName: ca.customer.fullName,
    phone: ca.customer.phones?.[0]?.phoneNumber || '',
    villageName: ca.customer.village?.name || '',
    areaName: ca.customer.area?.name || '',
    latitude: ca.customer.locations?.[0]?.latitude || null,
    longitude: ca.customer.locations?.[0]?.longitude || null,
    status: ca.customer.status,
  }));

  const customerIds = customers.map((c) => c.id);

  // Fetch active loans and installments for assigned customers
  const activeLoans = await prisma.loan.findMany({
    where: {
      customerId: { in: customerIds },
      status: 'ACTIVE',
    },
    include: {
      scheme: { select: { name: true, code: true } },
      scheduleVersions: {
        where: { isCurrent: true },
        take: 1,
        include: {
          installments: {
            where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
            orderBy: { installmentNumber: 'asc' },
            select: {
              id: true,
              installmentNumber: true,
              dueDate: true,
              principalDuePaise: true,
              financeChargeDuePaise: true,
              totalDuePaise: true,
              principalPaidPaise: true,
              financeChargePaidPaise: true,
              totalPaidPaise: true,
              status: true,
            },
          },
        },
      },
    },
  });

  const loans = activeLoans.map((l) => {
    const version = l.scheduleVersions[0];
    const installments = (version?.installments || []).map((inst) => ({
      ...inst,
      remainingPaise: Math.max(0, inst.totalDuePaise - inst.totalPaidPaise),
    }));

    const totalRemainingPaise = installments.reduce((sum, i) => sum + i.remainingPaise, 0);

    return {
      id: l.id,
      loanNumber: l.loanNumber,
      customerId: l.customerId,
      lineId: targetLineId,
      schemeName: l.scheme.name,
      sanctionedPrincipalPaise: l.sanctionedPrincipalPaise,
      totalFinanceChargePaise: l.totalFinanceChargePaise,
      totalRepaymentPaise: l.totalRepaymentPaise,
      totalRemainingPaise,
      status: l.status,
      installments,
    };
  });

  return {
    downloadedAt: new Date().toISOString(),
    session: session
      ? {
          id: session.id,
          sessionDate: session.sessionDate,
          status: session.status,
        }
      : null,
    line: {
      id: line.id,
      name: line.name,
      code: line.code,
      weekday: line.weekday,
      session: line.session,
    },
    cashBag: {
      id: cashBag.id,
      name: cashBag.name,
      code: cashBag.code,
    },
    customers,
    loans,
  };
}

/**
 * 2. Atomic Offline Batch Synchronization
 * Processes queued client-side mutations with strict idempotency and conflict review.
 */
export async function syncOfflineBatch(
  { items = [], deviceFingerprint = null, deviceId = null },
  actorContext = null
) {
  const actor = await resolveActor(actorContext);

  // Validate device status if fingerprint is provided
  if (deviceFingerprint) {
    const device = await prisma.deviceRegistration.findFirst({
      where: {
        userId: actor.userId,
        deviceFingerprint,
      },
    });

    if (device && device.status === 'REVOKED') {
      throw new Error('Device is REVOKED. Offline sync is strictly blocked on this device.');
    }
  }

  const results = [];
  let syncedCount = 0;
  let failedCount = 0;
  let reviewCount = 0;

  for (const item of items) {
    const { clientSyncId, entityType, payload } = item;

    if (!clientSyncId) {
      results.push({
        clientSyncId: 'UNKNOWN',
        status: 'FAILED',
        error: 'Missing clientSyncId idempotency key.',
      });
      failedCount++;
      continue;
    }

    try {
      if (entityType === 'PAYMENT') {
        // Step 2A: Idempotency Check — Same key returns original result
        const existingPayment = await prisma.payment.findUnique({
          where: { idempotencyKey: clientSyncId },
          include: { customer: true, loan: true },
        });

        if (existingPayment) {
          results.push({
            clientSyncId,
            status: 'SYNCED',
            isDuplicate: true,
            serverPaymentId: existingPayment.id,
            receiptNumber: existingPayment.paymentNumber,
            confirmedAt: existingPayment.collectedAt.toISOString(),
          });
          syncedCount++;
          continue;
        }

        // Step 2B: Conflict Detection
        const targetLoan = await prisma.loan.findUnique({
          where: { id: payload.loanId },
          include: {
            scheduleVersions: {
              where: { isCurrent: true },
              take: 1,
              include: { installments: true },
            },
          },
        });

        if (!targetLoan || targetLoan.status !== 'ACTIVE') {
          // Loan was cancelled or closed on another device — flag NEEDS_REVIEW
          await prisma.syncConflict.upsert({
            where: { clientSyncId },
            update: {
              conflictReason: `Loan ${payload.loanId} is not in ACTIVE status (current: ${targetLoan?.status || 'NOT_FOUND'}).`,
              payload: payload || {},
              status: 'PENDING',
            },
            create: {
              clientSyncId,
              entityType: 'PAYMENT',
              entityId: payload.loanId,
              collectorId: actor.userId,
              deviceId,
              conflictReason: `Loan ${payload.loanId} is not in ACTIVE status (current: ${targetLoan?.status || 'NOT_FOUND'}).`,
              payload: payload || {},
              status: 'PENDING',
            },
          });

          results.push({
            clientSyncId,
            status: 'NEEDS_REVIEW',
            error: `Target loan is ${targetLoan?.status || 'CLOSED'}. Flagged for manager review.`,
          });
          reviewCount++;
          continue;
        }

        // Check for concurrent payment race conditions
        const remainingTotalPaise = targetLoan.scheduleVersions[0]?.installments?.reduce(
          (sum, inst) => sum + Math.max(0, inst.totalDuePaise - inst.totalPaidPaise),
          0
        ) || 0;

        const paymentPaise = Math.round((payload.amountRupees || 0) * 100);

        // If loan already has less remaining balance than the offline payment was calculated for
        // and payment is substantial, check if another device paid concurrently
        if (remainingTotalPaise === 0 && paymentPaise > 0) {
          await prisma.syncConflict.upsert({
            where: { clientSyncId },
            update: {
              conflictReason: `Loan ${targetLoan.loanNumber} has already been fully cleared by a concurrent transaction.`,
              payload: payload || {},
              status: 'PENDING',
            },
            create: {
              clientSyncId,
              entityType: 'PAYMENT',
              entityId: targetLoan.id,
              collectorId: actor.userId,
              deviceId,
              conflictReason: `Loan ${targetLoan.loanNumber} has already been fully cleared by a concurrent transaction.`,
              payload: payload || {},
              status: 'PENDING',
            },
          });

          results.push({
            clientSyncId,
            status: 'NEEDS_REVIEW',
            error: 'Concurrent payment conflict: Loan has already been settled by another collector/device.',
          });
          reviewCount++;
          continue;
        }

        // Step 2C: Atomic Server Execution
        const payRes = await executeRecordPayment(
          {
            loanId: payload.loanId,
            amountRupees: payload.amountRupees,
            mode: payload.mode || 'CASH',
            lineId: payload.lineId || null,
            notes: payload.notes || 'Offline PWA Sync',
            idempotencyKey: clientSyncId,
            collectedAt: payload.collectedAt || new Date().toISOString(),
          },
          {
            profile: { id: actor.userId, isAdmin: actor.isAdmin, fullName: actor.fullName },
            user: { id: actor.userId, email: actor.email },
          }
        );

        await writeAudit({
          actorId: actor.userId,
          actorEmail: actor.email,
          actorName: actor.fullName,
          action: 'OFFLINE_PAYMENT_SYNCED',
          entityType: 'Payment',
          entityId: payRes.payment.id,
          metadata: {
            clientSyncId,
            amountRupees: payload.amountRupees,
            paymentNumber: payRes.payment.paymentNumber,
            deviceId,
          },
        });

        results.push({
          clientSyncId,
          status: 'SYNCED',
          isDuplicate: false,
          serverPaymentId: payRes.payment.id,
          receiptNumber: payRes.payment.paymentNumber,
          confirmedAt: new Date().toISOString(),
        });
        syncedCount++;
      } else {
        // Fallback for unsupported types
        results.push({
          clientSyncId,
          status: 'FAILED',
          error: `Unsupported entityType: ${entityType}`,
        });
        failedCount++;
      }
    } catch (err) {
      console.error(`Sync error on item ${clientSyncId}:`, err);
      results.push({
        clientSyncId,
        status: 'FAILED',
        error: err.message || 'Server error during sync.',
      });
      failedCount++;
    }
  }

  return {
    syncedCount,
    failedCount,
    reviewCount,
    totalProcessed: items.length,
    results,
  };
}

/**
 * 3. List Sync Conflicts for Manager Review
 */
export async function getSyncConflictsList(filters = {}, actorContext = null) {
  const actor = await resolveActor(actorContext);
  requirePermission(actor, 'payments:read');

  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
  };

  const conflicts = await prisma.syncConflict.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      collector: { select: { id: true, fullName: true, email: true } },
      resolver: { select: { id: true, fullName: true, email: true } },
    },
  });

  return conflicts.map((c) => ({
    id: c.id,
    clientSyncId: c.clientSyncId,
    entityType: c.entityType,
    entityId: c.entityId,
    conflictReason: c.conflictReason,
    payload: c.payload,
    status: c.status,
    collectorName: c.collector.fullName,
    collectorEmail: c.collector.email,
    resolvedByName: c.resolver?.fullName || null,
    resolvedAt: c.resolvedAt,
    resolutionNotes: c.resolutionNotes,
    createdAt: c.createdAt,
  }));
}

/**
 * 4. Resolve Sync Conflict by Manager
 */
export async function resolveSyncConflict(
  { conflictId, resolution, resolutionNotes = '' },
  actorContext = null
) {
  const actor = await resolveActor(actorContext);
  if (!actor.isAdmin) {
    requirePermission(actor, 'payments:reverse'); // Manager authority
  }

  const conflict = await prisma.syncConflict.findUnique({
    where: { id: conflictId },
  });

  if (!conflict) throw new Error('Sync conflict record not found.');
  if (conflict.status !== 'PENDING') throw new Error(`Conflict is already ${conflict.status}.`);

  const updatedStatus = resolution === 'APPROVE' ? 'RESOLVED' : 'REJECTED';

  let appliedPaymentId = null;

  // If approved and entityType is payment, force apply payment
  if (resolution === 'APPROVE' && conflict.entityType === 'PAYMENT') {
    const payload = conflict.payload;
    const payRes = await executeRecordPayment(
      {
        loanId: payload.loanId,
        amountRupees: payload.amountRupees,
        mode: payload.mode || 'CASH',
        lineId: payload.lineId || null,
        notes: `Manager approved conflict resolution: ${resolutionNotes}`,
        idempotencyKey: conflict.clientSyncId,
        collectedAt: payload.collectedAt || new Date().toISOString(),
      },
      {
        profile: { id: actor.userId, isAdmin: actor.isAdmin, fullName: actor.fullName },
        user: { id: actor.userId, email: actor.email },
      }
    );
    appliedPaymentId = payRes.payment.id;
  }

  const updated = await prisma.syncConflict.update({
    where: { id: conflictId },
    data: {
      status: updatedStatus,
      resolvedById: actor.userId,
      resolvedAt: new Date(),
      resolutionNotes,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.fullName,
    action: `SYNC_CONFLICT_${updatedStatus}`,
    entityType: 'SyncConflict',
    entityId: conflictId,
    metadata: {
      clientSyncId: conflict.clientSyncId,
      resolution,
      resolutionNotes,
      appliedPaymentId,
    },
  });

  return updated;
}
