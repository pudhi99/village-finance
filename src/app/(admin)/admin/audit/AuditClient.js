'use client';

import { useState } from 'react';
import { Shield, Clock, User, Filter } from 'lucide-react';

export default function AuditClient({ initialLogs }) {
  const [logs] = useState(initialLogs);
  const [filterAction, setFilterAction] = useState('ALL');

  const actionTypes = ['ALL', ...Array.from(new Set(logs.map((l) => l.action)))];

  const filteredLogs = filterAction === 'ALL'
    ? logs
    : logs.filter((l) => l.action === filterAction);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security & Audit Logs</h1>
          <p className="text-slate-400 text-sm mt-1">
            Immutable audit record of user lifecycle, role grants, device revocations, and data mutations.
          </p>
        </div>

        {/* Action filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {actionTypes.map((action) => (
              <option key={action} value={action}>
                {action === 'ALL' ? 'All Actions' : action}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Actor</th>
                <th className="px-5 py-3.5">Target Entity</th>
                <th className="px-5 py-3.5">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-sans">
                    No audit records match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-sans">
                      <div className="text-white text-xs font-medium">{log.actorName}</div>
                      <div className="text-[11px] text-slate-500">{log.actorEmail}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-sans">
                      <span className="text-slate-200 font-medium">{log.entityType}</span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-[120px]">
                        {log.entityId}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      <pre className="text-[11px] bg-slate-950/80 p-2 rounded-lg border border-slate-800 max-w-md overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
