'use client';

import { useState } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  WifiOff,
  Wifi,
  Trash2,
  Receipt,
} from 'lucide-react';
import { triggerSyncQueue, clearOfflineCache } from '@/lib/offline/sync-engine';

export default function SyncCenterModal({ open, onClose, stats, isOnline, onRefresh }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);

  if (!open) return null;

  async function handleSyncNow() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await triggerSyncQueue();
      setSyncResult(res);
      await onRefresh();
    } catch (err) {
      setError(err.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearCache() {
    const unsynced = (stats?.pendingCount || 0) + (stats?.failedCount || 0) + (stats?.reviewCount || 0);
    if (unsynced > 0) {
      if (!confirm(`Warning: You have ${unsynced} unsynced records! Force clearing will cause data loss. Are you completely sure?`)) {
        return;
      }
    } else {
      if (!confirm('Clear all local offline cache?')) {
        return;
      }
    }

    try {
      await clearOfflineCache(true);
      await onRefresh();
      alert('Local offline cache cleared.');
      onClose();
    } catch (err) {
      alert(err.message);
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'SYNCED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            <span>Synced</span>
          </span>
        );
      case 'NEEDS_REVIEW':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3" />
            <span>Needs Review</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'SYNCING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1 w-fit">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Syncing</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" />
            <span>Local Pending</span>
          </span>
        );
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isOnline ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-amber-950/80 text-amber-400 border border-amber-800'}`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                Offline PWA & Durable Sync Center
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                <span className={isOnline ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                  {isOnline ? 'Network Connected (Online)' : 'No Connection (Offline Mode)'}
                </span>
                <span>•</span>
                <span>{stats?.pendingCount || 0} pending sync</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={syncing || !isOnline || (stats?.pendingCount === 0 && stats?.failedCount === 0)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              Refresh Queue
            </button>
          </div>

          <button
            onClick={handleClearCache}
            className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg flex items-center gap-1 transition-colors"
            title="Clear offline storage"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Local Cache</span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {syncResult && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              Sync completed: {syncResult.syncedCount || 0} synced, {syncResult.reviewCount || 0} review, {syncResult.failedCount || 0} failed.
            </span>
          </div>
        )}

        {/* Sync Queue List */}
        <div className="flex-1 p-4 overflow-y-auto">
          {!stats?.items?.length ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <span>No offline mutations in queue. All records are in sync.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.items.map((item) => (
                <div
                  key={item.clientSyncId}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{item.entityType}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {item.clientSyncId.slice(0, 12)}...
                      </span>
                      {getStatusBadge(item.status)}
                    </div>

                    <div className="text-xs text-slate-300">
                      Amount: <span className="font-bold text-white">₹{item.payload?.amountRupees || 0}</span> ({item.payload?.mode || 'CASH'})
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Recorded: {new Date(item.createdAt).toLocaleString()}
                      {item.attempts > 0 && ` • Retries: ${item.attempts}`}
                    </div>

                    {item.syncError && (
                      <div className="text-[11px] text-rose-400 font-mono mt-1 bg-rose-950/40 p-1.5 rounded border border-rose-900/60">
                        Error: {item.syncError}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
