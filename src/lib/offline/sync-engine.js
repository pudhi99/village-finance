/**
 * Client-Side Offline & Sync Engine — Village Finance (Module 09)
 *
 * Implements:
 * 1. Offline storage of downloaded routes and customers into Dexie.
 * 2. Durable local payment recording with Provisional Receipts.
 * 3. Automatic and manual synchronization to server.
 * 4. Protection against data loss on cache clear.
 */

import { offlineDB } from './db.js';
import { syncOfflineBatch } from '@/features/sync/server-actions';

/**
 * Generate a client-side UUID v4.
 */
export function generateClientUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Save pre-trip downloaded route into IndexedDB.
 */
export async function saveOfflinePackage(pkg) {
  if (!pkg || !offlineDB) return;

  await offlineDB.transaction(
    'rw',
    [
      offlineDB.offlineSessions,
      offlineDB.offlineCustomers,
      offlineDB.offlineLoans,
      offlineDB.offlineInstallments,
    ],
    async () => {
      // Clear previous cached route data
      await offlineDB.offlineSessions.clear();
      await offlineDB.offlineCustomers.clear();
      await offlineDB.offlineLoans.clear();
      await offlineDB.offlineInstallments.clear();

      if (pkg.session) {
        await offlineDB.offlineSessions.put({
          ...pkg.session,
          lineId: pkg.line.id,
          downloadedAt: pkg.downloadedAt,
        });
      }

      if (pkg.customers?.length) {
        await offlineDB.offlineCustomers.bulkPut(
          pkg.customers.map((c) => ({ ...c, lineId: pkg.line.id }))
        );
      }

      if (pkg.loans?.length) {
        for (const loan of pkg.loans) {
          await offlineDB.offlineLoans.put({
            id: loan.id,
            loanNumber: loan.loanNumber,
            customerId: loan.customerId,
            lineId: pkg.line.id,
            schemeName: loan.schemeName,
            sanctionedPrincipalPaise: loan.sanctionedPrincipalPaise,
            totalFinanceChargePaise: loan.totalFinanceChargePaise,
            totalRepaymentPaise: loan.totalRepaymentPaise,
            totalRemainingPaise: loan.totalRemainingPaise,
            status: loan.status,
          });

          if (loan.installments?.length) {
            await offlineDB.offlineInstallments.bulkPut(
              loan.installments.map((inst) => ({
                ...inst,
                loanId: loan.id,
              }))
            );
          }
        }
      }
    }
  );

  return { success: true, customersCount: pkg.customers?.length || 0, loansCount: pkg.loans?.length || 0 };
}

/**
 * Record a payment offline into durable queue and issue Provisional Receipt.
 */
export async function recordOfflinePayment({
  loanId,
  customerId,
  customerName = '',
  loanNumber = '',
  amountRupees,
  mode = 'CASH',
  lineId = null,
  sessionId = null,
  cashBagId = null,
  notes = '',
  gps = null,
}) {
  const clientSyncId = generateClientUUID();
  const timestamp = new Date().toISOString();
  const provisionalReceiptNumber = `PROV-${clientSyncId.slice(0, 8).toUpperCase()}`;

  const payload = {
    loanId,
    customerId,
    amountRupees: Number(amountRupees),
    mode,
    lineId,
    sessionId,
    cashBagId,
    notes,
    gps,
    collectedAt: timestamp,
  };

  await offlineDB.transaction('rw', [offlineDB.syncQueue, offlineDB.cachedReceipts], async () => {
    // 1. Add to durable sync queue
    await offlineDB.syncQueue.put({
      clientSyncId,
      entityType: 'PAYMENT',
      entityId: loanId,
      payload,
      status: 'LOCAL_PENDING',
      syncError: null,
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // 2. Add to cached receipts as provisional
    await offlineDB.cachedReceipts.put({
      id: clientSyncId,
      clientSyncId,
      receiptNumber: provisionalReceiptNumber,
      customerName,
      loanNumber,
      amountRupees: Number(amountRupees),
      mode,
      timestamp,
      isServerConfirmed: false,
    });
  });

  return {
    clientSyncId,
    receiptNumber: provisionalReceiptNumber,
    isServerConfirmed: false,
    timestamp,
    message: 'Payment recorded offline. Provisional receipt issued. Will sync automatically once online.',
  };
}

/**
 * Process durable offline sync queue.
 */
export async function triggerSyncQueue(deviceFingerprint = null) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { error: 'Network is currently offline. Cannot sync.', isOffline: true };
  }

  // Fetch items needing sync
  const itemsToSync = await offlineDB.syncQueue
    .where('status')
    .anyOf(['LOCAL_PENDING', 'FAILED'])
    .toArray();

  if (itemsToSync.length === 0) {
    return { syncedCount: 0, pendingCount: 0, message: 'Queue is clean.' };
  }

  // Mark items as SYNCING
  const ids = itemsToSync.map((i) => i.clientSyncId);
  await offlineDB.syncQueue
    .where('clientSyncId')
    .anyOf(ids)
    .modify({ status: 'SYNCING', updatedAt: new Date().toISOString() });

  try {
    const batchResponse = await syncOfflineBatch({
      items: itemsToSync.map((i) => ({
        clientSyncId: i.clientSyncId,
        entityType: i.entityType,
        entityId: i.entityId,
        payload: i.payload,
      })),
      deviceFingerprint,
    });

    // Update statuses based on server results
    await offlineDB.transaction('rw', [offlineDB.syncQueue, offlineDB.cachedReceipts], async () => {
      for (const res of batchResponse.results) {
        const queueItem = await offlineDB.syncQueue.get({ clientSyncId: res.clientSyncId });
        if (!queueItem) continue;

        if (res.status === 'SYNCED') {
          await offlineDB.syncQueue.update(queueItem.localId, {
            status: 'SYNCED',
            syncError: null,
            updatedAt: new Date().toISOString(),
          });

          // Confirm the receipt
          const receipt = await offlineDB.cachedReceipts.get({ clientSyncId: res.clientSyncId });
          if (receipt) {
            await offlineDB.cachedReceipts.update(receipt.id, {
              receiptNumber: res.receiptNumber,
              isServerConfirmed: true,
              confirmedAt: res.confirmedAt,
            });
          }
        } else if (res.status === 'NEEDS_REVIEW') {
          await offlineDB.syncQueue.update(queueItem.localId, {
            status: 'NEEDS_REVIEW',
            syncError: res.error,
            updatedAt: new Date().toISOString(),
          });
        } else {
          await offlineDB.syncQueue.update(queueItem.localId, {
            status: 'FAILED',
            syncError: res.error,
            attempts: (queueItem.attempts || 0) + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    return batchResponse;
  } catch (err) {
    // If entire batch network call failed, revert back to FAILED
    await offlineDB.syncQueue
      .where('clientSyncId')
      .anyOf(ids)
      .modify((item) => {
        item.status = 'FAILED';
        item.syncError = err.message || 'Network sync error';
        item.attempts = (item.attempts || 0) + 1;
        item.updatedAt = new Date().toISOString();
      });

    throw err;
  }
}

/**
 * Get count and summary of offline queue.
 */
export async function getOfflineStats() {
  if (typeof window === 'undefined' || !offlineDB) {
    return { total: 0, pendingCount: 0, failedCount: 0, reviewCount: 0, syncedCount: 0 };
  }

  const allItems = await offlineDB.syncQueue.toArray();
  const pendingCount = allItems.filter((i) => i.status === 'LOCAL_PENDING' || i.status === 'SYNCING').length;
  const failedCount = allItems.filter((i) => i.status === 'FAILED').length;
  const reviewCount = allItems.filter((i) => i.status === 'NEEDS_REVIEW').length;
  const syncedCount = allItems.filter((i) => i.status === 'SYNCED').length;

  return {
    total: allItems.length,
    pendingCount,
    failedCount,
    reviewCount,
    syncedCount,
    items: allItems,
  };
}

/**
 * Clear offline cache with protection against losing unsynced mutations.
 */
export async function clearOfflineCache(forceConfirmed = false) {
  const stats = await getOfflineStats();
  const unsyncedCount = stats.pendingCount + stats.failedCount + stats.reviewCount;

  if (unsyncedCount > 0 && !forceConfirmed) {
    throw new Error(
      `Cannot clear cache: You have ${unsyncedCount} unsynced record(s) in local queue. Please sync or export them before clearing.`
    );
  }

  await offlineDB.transaction(
    'rw',
    [
      offlineDB.offlineSessions,
      offlineDB.offlineCustomers,
      offlineDB.offlineLoans,
      offlineDB.offlineInstallments,
      offlineDB.syncQueue,
      offlineDB.cachedReceipts,
    ],
    async () => {
      await offlineDB.offlineSessions.clear();
      await offlineDB.offlineCustomers.clear();
      await offlineDB.offlineLoans.clear();
      await offlineDB.offlineInstallments.clear();
      await offlineDB.syncQueue.clear();
      await offlineDB.cachedReceipts.clear();
    }
  );

  return { success: true };
}
