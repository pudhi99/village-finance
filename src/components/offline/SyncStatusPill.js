'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { getOfflineStats, triggerSyncQueue } from '@/lib/offline/sync-engine';
import SyncCenterModal from './SyncCenterModal';

function subscribeOnline(callback) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function getOnlineServerSnapshot() {
  return true;
}

export default function SyncStatusPill() {
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );

  const [stats, setStats] = useState({
    pendingCount: 0,
    failedCount: 0,
    reviewCount: 0,
    syncedCount: 0,
    items: [],
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      const currentStats = await getOfflineStats();
      setStats(currentStats);
    } catch {
      // IndexedDB not ready or error
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refreshStats, 500);
    const interval = setInterval(refreshStats, 15000); // Check every 15s

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [refreshStats]);

  // When coming back online, auto-trigger background sync
  useEffect(() => {
    if (!isOnline) return;

    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      setSyncing(true);
      triggerSyncQueue()
        .then(() => {
          if (active) refreshStats();
        })
        .catch(() => {})
        .finally(() => {
          if (active) setSyncing(false);
        });
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOnline, refreshStats]);

  const pendingTotal = (stats?.pendingCount || 0) + (stats?.failedCount || 0);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
          !isOnline
            ? 'bg-amber-950/80 text-amber-300 border-amber-800 hover:bg-amber-900/60'
            : pendingTotal > 0
            ? 'bg-blue-950 text-blue-300 border-blue-800 hover:bg-blue-900/60'
            : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900/40'
        }`}
        title="Offline PWA & Durable Sync Status"
      >
        {!isOnline ? (
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
        ) : syncing ? (
          <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
        ) : (
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
        )}

        <span>
          {!isOnline
            ? pendingTotal > 0
              ? `Offline (${pendingTotal})`
              : 'Offline Mode'
            : pendingTotal > 0
            ? `${pendingTotal} to sync`
            : 'Online'}
        </span>
      </button>

      <SyncCenterModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        stats={stats}
        isOnline={isOnline}
        onRefresh={refreshStats}
      />
    </>
  );
}
