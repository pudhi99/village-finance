'use client';

import { useState } from 'react';
import { Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { downloadSessionOfflinePackage } from '@/features/sync/server-actions';
import { saveOfflinePackage } from '@/lib/offline/sync-engine';

export default function PreTripDownloadButton({ sessionId = null, lineId = null, lineName = '' }) {
  const [downloading, setDownloading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleDownload() {
    setDownloading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const pkg = await downloadSessionOfflinePackage({ sessionId, lineId });
      const res = await saveOfflinePackage(pkg);
      setSuccessMsg(`Cached ${res.customersCount} customer(s) & ${res.loansCount} loan(s) offline.`);
    } catch (err) {
      console.error('Pre-trip download failed:', err);
      setErrorMsg(err.message || 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors shadow-sm"
        title={`Download route ${lineName} data for offline collection`}
      >
        <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
        <span>{downloading ? 'Downloading Route...' : 'Pre-Trip Download'}</span>
      </button>

      {successMsg && (
        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{successMsg}</span>
        </span>
      )}

      {errorMsg && (
        <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{errorMsg}</span>
        </span>
      )}
    </div>
  );
}
