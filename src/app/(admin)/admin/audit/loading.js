import { ShieldAlert, Search } from 'lucide-react';

export default function AuditLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-amber-400" />
            Immutable Audit Log
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Tamper-evident trail of financial approvals, disbursements, reversals, and exports.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <tr key={i} className="hover:bg-slate-800/40">
                <td className="py-3.5 px-4 font-mono text-xs">
                  <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
                </td>
                <td className="py-3.5 px-4">
                  <div className="h-5 w-28 bg-amber-950/70 border border-amber-900 rounded-md animate-pulse" />
                </td>
                <td className="py-3.5 px-4 space-y-1">
                  <div className="h-4 w-28 bg-slate-800 rounded animate-pulse" />
                  <div className="h-3 w-36 bg-slate-800/50 rounded animate-pulse" />
                </td>
                <td className="py-3.5 px-4">
                  <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
                </td>
                <td className="py-3.5 px-4">
                  <div className="h-4 w-48 bg-slate-800/60 rounded animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
