import { Users, UserPlus, Search } from 'lucide-react';

export default function UsersLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-400" />
            User & Role Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            System accounts, granular RBAC permissions, and physical device registry.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700/50 text-white font-medium rounded-lg text-sm border border-blue-800 shadow">
          <UserPlus className="w-4 h-4" />
          <span>Invite Team Member</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Roles & Scope</th>
              <th className="py-3 px-4">Assigned Line</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="hover:bg-slate-800/40">
                <td className="py-3.5 px-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 shrink-0 animate-pulse" />
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-40 bg-slate-800/50 rounded animate-pulse" />
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="h-5 w-24 bg-blue-950/80 border border-blue-900 rounded-md animate-pulse" />
                </td>
                <td className="py-3.5 px-4">
                  <div className="h-4 w-20 bg-slate-800 rounded animate-pulse" />
                </td>
                <td className="py-3.5 px-4 text-center">
                  <div className="h-5 w-16 bg-emerald-950/80 rounded-full mx-auto animate-pulse" />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="h-4 w-12 bg-slate-800 rounded ml-auto animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
