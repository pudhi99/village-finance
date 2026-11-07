/**
 * Dexie Offline IndexedDB Database — Village Finance (Module 09)
 *
 * Implements client-side storage for:
 * 1. Pre-trip downloaded session data (customers, loans, installments dues).
 * 2. Durable mutations sync queue (payments, visits, expenses).
 * 3. Local receipt cache (distinguishing provisional vs server-confirmed receipts).
 */

import Dexie from 'dexie';

export class VillageFinanceOfflineDB extends Dexie {
  constructor() {
    super('VillageFinanceOfflineDB');

    this.version(1).stores({
      offlineSessions: 'id, lineId, sessionDate, status',
      offlineCustomers: 'id, lineId, customerNumber, fullName, phone',
      offlineLoans: 'id, customerId, lineId, loanNumber, status',
      offlineInstallments: 'id, loanId, installmentNumber, dueDate, status',
      syncQueue: '++localId, &clientSyncId, entityType, entityId, status, createdAt',
      cachedReceipts: 'id, &clientSyncId, receiptNumber, loanNumber, isServerConfirmed',
    });
  }
}

// Singleton database instance
export const offlineDB = new VillageFinanceOfflineDB();
